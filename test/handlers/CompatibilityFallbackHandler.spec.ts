import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { compatFallbackHandlerContract, getCompatFallbackHandler, getContractFactoryByName, getSafeWithOwners, getWallets } from "../utils/setup";
import { buildSignatureBytes, executeContractCallWithSigners, calculateSafeMessageHash, EIP712_SAFE_MESSAGE_TYPE, signHash } from "../../src/utils/execution";
import { chainId } from "../utils/encoding";
import { BigNumber } from "ethers";
import { killLibContract } from "../utils/contracts";

describe("CompatibilityFallbackHandler", async () => {

    const [user1, user2] = getWallets(hre);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const signLib = await (await getContractFactoryByName("SignMessageLib")).deploy();
        await signLib.deployed();

        const handler = await getCompatFallbackHandler();
        await handler.deployed();

        const safe = await getSafeWithOwners([user1.address, user2.address], 2, handler.address);
        const validator = (await compatFallbackHandlerContract()).attach(safe.address);
        await validator.deployed();

        const killLib = await killLibContract(user1);
        return {
            safe,
            validator,
            handler,
            killLib,
            signLib
        }
    })

    describe("ERC1155", async () => {
        it('to handle onERC1155Received', async () => {
            const { handler } = await setupTests()
            await expect(
                await handler.callStatic.onERC1155Received(AddressZero, AddressZero, 0, 0, "0x")
            ).to.be.eq("0xf23a6e61")
        })

        it('to handle onERC1155BatchReceived', async () => {
            const { handler } = await setupTests()
            await expect(
                await handler.callStatic.onERC1155BatchReceived(AddressZero, AddressZero, [], [], "0x")
            ).to.be.eq("0xbc197c81")
        })
    })

    describe("ERC721", async () => {
        it('to handle onERC721Received', async () => {
            const { handler } = await setupTests()
            await expect(
                await handler.callStatic.onERC721Received(AddressZero, AddressZero, 0, "0x")
            ).to.be.eq("0x150b7a02")
        })
    })

    describe("ERC777", async () => {
        it('to handle tokensReceived', async () => {
            const { handler } = await setupTests()
            await handler.callStatic.tokensReceived(AddressZero, AddressZero, AddressZero, 0, "0x", "0x")
        })
    })
    
    describe("isValidSignature(bytes,bytes)", async () => {

        it('should revert if called directly', async () => {
            const { handler } = await setupTests()
            await expect(
                handler.callStatic['isValidSignature(bytes,bytes)']("0xbaddad", "0x")
            ).to.be.revertedWith(hre.network.zksync ? "call revert exception" : "function call to a non-contract account")
        })

        it('should revert if message was not signed', async () => {
            const { validator } = await setupTests()
            await expect(validator.callStatic['isValidSignature(bytes,bytes)']("0xbaddad", "0x")).to.be.revertedWith("Hash not approved")
        })

        it('should revert if signature is not valid', async () => {
            const { validator } = await setupTests()
            await expect(validator.callStatic['isValidSignature(bytes,bytes)']("0xbaddad", "0xdeaddeaddeaddead")).to.be.reverted
        })

        it('should return magic value if message was signed', async () => {
            const { safe, validator, signLib } = await setupTests()
            await (await executeContractCallWithSigners(safe, signLib, "signMessage", ["0xbaddad"], [user1, user2], true)).wait()
            expect(await validator.callStatic['isValidSignature(bytes,bytes)']("0xbaddad", "0x")).to.be.eq("0x20c13b0b")
        })

        it('should return magic value if enough owners signed', async () => {
            const { validator } = await setupTests()
            const sig1 = {
                signer: user1.address,
                data: await user1._signTypedData({ verifyingContract: validator.address, chainId: await chainId() }, EIP712_SAFE_MESSAGE_TYPE, { message: "0xbaddad" })
            }
            const sig2 = await signHash(user2, calculateSafeMessageHash(validator, "0xbaddad", await chainId()))
            expect(await validator.callStatic['isValidSignature(bytes,bytes)']("0xbaddad", buildSignatureBytes([sig1, sig2]))).to.be.eq("0x20c13b0b")
        })
    })
    
    describe("isValidSignature(bytes32,bytes)", async () => {

        it('should revert if called directly', async () => {
            const { handler } = await setupTests()
            const dataHash = ethers.utils.keccak256("0xbaddad")
            await expect(
                handler.callStatic['isValidSignature(bytes32,bytes)'](dataHash, "0x")
            ).to.be.revertedWith(hre.network.zksync ? "call revert exception" : "function call to a non-contract account")
        })

        it('should revert if message was not signed', async () => {
            const { validator } = await setupTests()
            const dataHash = ethers.utils.keccak256("0xbaddad")
            await expect(validator.callStatic['isValidSignature(bytes32,bytes)'](dataHash, "0x")).to.be.revertedWith("Hash not approved")
        })

        it('should revert if signature is not valid', async () => {
            const { validator } = await setupTests()
            const dataHash = ethers.utils.keccak256("0xbaddad")
            await expect(validator.callStatic['isValidSignature(bytes32,bytes)'](dataHash, "0xdeaddeaddeaddead")).to.be.reverted
        })

        it('should return magic value if message was signed', async () => {
            const { safe, validator, signLib } = await setupTests()
            const dataHash = ethers.utils.keccak256("0xbaddad")
            await (await executeContractCallWithSigners(safe, signLib, "signMessage", [dataHash], [user1, user2], true)).wait();
            expect(await validator.callStatic['isValidSignature(bytes32,bytes)'](dataHash, "0x")).to.be.eq("0x1626ba7e")
        })

        it('should return magic value if enough owners signed', async () => {
            const { validator } = await setupTests()
            const dataHash = ethers.utils.keccak256("0xbaddad")
            const sig1 = {
                signer: user1.address,
                data: await user1._signTypedData({ verifyingContract: validator.address, chainId: await chainId() }, EIP712_SAFE_MESSAGE_TYPE, { message: dataHash })
            }
            const sig2 = await signHash(user2, calculateSafeMessageHash(validator,dataHash, await chainId()))
            expect(await validator.callStatic['isValidSignature(bytes32,bytes)'](dataHash, buildSignatureBytes([sig1, sig2]))).to.be.eq("0x1626ba7e")
        })
    })

    describe("getModules", async () => {
        it('returns enabled modules', async () => {
            const { safe, validator } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1, user2])
            ).to.emit(safe, "EnabledModule").withArgs(user2.address)

            await expect(
                await safe.isModuleEnabled(user2.address)
            ).to.be.true

            await expect(
                await validator.getModules()
            ).to.be.deep.equal([user2.address])
        })
    })

    describe("getMessageHash", async () => {
        it('should generate the correct hash', async () => {
            const { safe, validator } = await setupTests()
            expect(
                await validator.getMessageHash("0xdead")
            ).to.be.eq(calculateSafeMessageHash(safe, "0xdead", await chainId()))
        })
    })

    describe("getMessageHashForSafe", async () => {
        it('should revert if target does not return domain separator', async () => {
            const { handler } = await setupTests()
            await expect(
                handler.getMessageHashForSafe(handler.address, "0xdead")
            ).to.be.reverted
        })

        it('should generate the correct hash', async () => {
            const { handler, safe } = await setupTests()
            expect(
                await handler.getMessageHashForSafe(safe.address, "0xdead")
            ).to.be.eq(calculateSafeMessageHash(safe, "0xdead", await chainId()))
        })
    })

    describe("simulate", async () => {

        it.skip('can be called for any Safe', async () => {
        })

        it('should revert changes', async function () {
            /**
             * ## Test not applicable for zkSync, therefore should skip.
             * @see https://era.zksync.io/docs/dev/building-on-zksync/contracts/differences-with-ethereum.html#selfdestruct
             */
            if (hre.network.zksync) this.skip();

            const { validator, killLib } = await setupTests()
            const code = await ethers.provider.getCode(validator.address)
            expect(
                await validator.callStatic.simulate(killLib.address, killLib.interface.encodeFunctionData("killme"))
            ).to.be.eq("0x")
            expect(
                await ethers.provider.getCode(validator.address)
            ).to.be.eq(code)
        })

        it('should return result', async () => {
            const { validator, killLib, handler } = await setupTests()
            expect(
                await validator.callStatic.simulate(killLib.address, killLib.interface.encodeFunctionData("expose"))
            ).to.be.eq("0x000000000000000000000000" + handler.address.slice(2).toLowerCase())
        })

        it('should propagate revert message', async () => {
            const { validator, killLib } = await setupTests()
            await expect(
                validator.callStatic.simulate(killLib.address, killLib.interface.encodeFunctionData("trever"))
            ).to.revertedWith("Why are you doing this?")
        })

        it('should simulate transaction', async () => {
            const { validator, killLib } = await setupTests()
            const estimate = await validator.callStatic.simulate(
                killLib.address,
                killLib.interface.encodeFunctionData("estimate", [validator.address, "0x"])
            )
            expect(BigNumber.from(estimate).toNumber()).to.be.lte(5000)
        })

        it('should return modified state', async () => {
            const { validator, killLib } = await setupTests()
            const value = await validator.callStatic.simulate(
                killLib.address,
                killLib.interface.encodeFunctionData("updateAndGet", [])
            )
            expect(BigNumber.from(value).toNumber()).to.be.eq(1)
            expect((await killLib.value()).toNumber()).to.be.eq(0)
        })
    })
})
