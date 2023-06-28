import { expect } from "chai";
import hre, { deployments } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { defaultCallbackHandlerDeployment, getContractFactoryByName, getSafeTemplate, getWallets } from "../utils/setup";

describe("GnosisSafe", async () => {

    const mockErc1155 = async () => {
        const Erc1155factory = await getContractFactoryByName("ERC1155Token");
        const Erc1155 = await Erc1155factory.deploy()
        await Erc1155.deployed()
        return Erc1155
    }

    const setupWithTemplate = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeTemplate(),
            token: await mockErc1155()
        }
    })

    const [user1, user2] = getWallets(hre);

    describe("ERC1155", async () => {
        it('should reject if callback not accepted', async () => {
            const { safe, token } = await setupWithTemplate()

            // Setup Safe
            await (await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)).wait()

            // Mint test tokens
            await (await token.mint(user1.address, 23, 1337, "0x")).wait()
            await expect(await token.balanceOf(user1.address, 23)).to.be.deep.eq(BigNumber.from(1337))

            await expect(
                token.mint(safe.address, 23, 1337, "0x"),
                "Should not accept minted token if handler not set"
            ).to.be.reverted
            
            await expect(
                token.safeTransferFrom(user1.address, safe.address, 23, 1337, "0x"),
                "Should not accept sent token if handler not set"
            ).to.be.reverted
        })

        it('should not reject if callback is accepted', async () => {
            const { safe, token } = await setupWithTemplate()
            const handler = await defaultCallbackHandlerDeployment()

            // Setup Safe
            await (await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", handler.address, AddressZero, 0, AddressZero)).wait()

            await (await token.mint(safe.address, 23, 1337, "0x")).wait()
            await expect(await token.balanceOf(safe.address, 23)).to.be.deep.eq(BigNumber.from(1337))

            await(await token.mint(user1.address, 23, 23, "0x")).wait()
            await expect(await token.balanceOf(user1.address, 23)).to.be.deep.eq(BigNumber.from(23))
            
            await(await token.safeTransferFrom(user1.address, safe.address, 23, 23, "0x")).wait()
            await expect(await token.balanceOf(user1.address, 23)).to.be.deep.eq(BigNumber.from(0))
            await expect(await token.balanceOf(safe.address, 23)).to.be.deep.eq(BigNumber.from(1360))
        })
    })
})
