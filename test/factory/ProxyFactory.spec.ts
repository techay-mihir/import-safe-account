import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployContract, getFactory, getMock, getSafeWithOwners, getSafeProxyRuntimeCode, getWallets } from "../utils/setup";
import { AddressZero } from "@ethersproject/constants";
import { BigNumber, Contract } from "ethers";
import { calculateProxyAddress, calculateProxyAddressWithCallback } from "../../src/utils/proxies";
import { getAddress } from "ethers/lib/utils";
import { utils } from "zksync-web3";

const NONCE_HOLDER_SYSTEM_CONTRACT = "0x0000000000000000000000000000000000008003";
const NONCE_HOLDER_SYSTEM_CONTRACT_ABI = [ "function getDeploymentNonce(address _address) external view returns (uint256 deploymentNonce)" ];

describe("ProxyFactory", async () => {

    const SINGLETON_SOURCE = `
    contract Test {
        address _singleton;
        address public creator;
        bool public isInitialized;
        constructor() payable {
            creator = msg.sender;
        }

        function init() public {
            require(!isInitialized, "Is initialized");
            creator = msg.sender;
            isInitialized = true;
        }

        function masterCopy() public pure returns (address) {
            return address(0);
        }

        function forward(address to, bytes memory data) public returns (bytes memory result) {
            (,result) = to.call(data);
        }
    }`

    const [user1] = getWallets(hre);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture()
        const singleton = await deployContract(user1, SINGLETON_SOURCE)
        return {
            safe: await getSafeWithOwners([user1.address]),
            factory: await getFactory(),
            mock: await getMock(),
            singleton
        }
    })

    describe("createProxy", async () => {

        it('should revert with invalid singleton address', async () => {
            const { factory } = await setupTests()
            await expect(
                factory.createProxy(AddressZero, "0x")
            ).to.be.revertedWith("Invalid singleton address provided")
        })

        it('should revert with invalid initializer', async () => {
            const { factory, singleton } = await setupTests()
            await expect(
                factory.createProxy(singleton.address, "0x42baddad")
            ).to.be.revertedWith(hre.network.zksync ? "execution reverted" : "Transaction reverted without a reason")
        })

        it('should emit event without initializing', async () => {
            const { factory, singleton } = await setupTests()
            let proxyAddress;
            if (!hre.network.zksync){
                const factoryNonce = await ethers.provider.getTransactionCount(factory.address)
                proxyAddress = ethers.utils.getContractAddress({ from: factory.address, nonce: factoryNonce })
            } else {
                const nonceHolderContract = new ethers.Contract(NONCE_HOLDER_SYSTEM_CONTRACT, NONCE_HOLDER_SYSTEM_CONTRACT_ABI, user1);
                const factoryNonce = await nonceHolderContract.getDeploymentNonce(factory.address);
                proxyAddress = utils.createAddress(factory.address, ethers.BigNumber.from(factoryNonce));
            }
            await expect(
                factory.createProxy(singleton.address, "0x")
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress, singleton.address)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(AddressZero)
            expect(await proxy.isInitialized()).to.be.eq(false)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode())
        })

        it('should emit event with initializing', async () => {
            const { factory, singleton } = await setupTests()
            let proxyAddress;
            if (!hre.network.zksync){
                const factoryNonce = await ethers.provider.getTransactionCount(factory.address)
                proxyAddress = ethers.utils.getContractAddress({ from: factory.address, nonce: factoryNonce })
            } else {
                const nonceHolderContract = new ethers.Contract(NONCE_HOLDER_SYSTEM_CONTRACT, NONCE_HOLDER_SYSTEM_CONTRACT_ABI, user1);
                const factoryNonce = await nonceHolderContract.getDeploymentNonce(factory.address);
                proxyAddress = utils.createAddress(factory.address, ethers.BigNumber.from(factoryNonce));
            }
            await expect(
                factory.createProxy(singleton.address, singleton.interface.encodeFunctionData("init", []))
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress, singleton.address)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(factory.address)
            expect(await proxy.isInitialized()).to.be.eq(true)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode())
        })
    })

    describe("createProxyWithNonce", async () => {

        const saltNonce = 42

        it('should revert with invalid singleton address', async () => {
            const { factory } = await setupTests()
            await expect(
                factory.createProxyWithNonce(AddressZero, "0x", saltNonce)
            ).to.be.revertedWith("Create2 call failed")
        })

        it('should revert with invalid initializer', async () => {
            const { factory, singleton } = await setupTests()
            await expect(
                factory.createProxyWithNonce(singleton.address, "0x42baddad", saltNonce)
            ).to.be.revertedWith(hre.network.zksync ? "execution reverted" : "Transaction reverted without a reason")
        })

        it('should emit event without initializing', async () => {
            const { factory, singleton } = await setupTests()
            const initCode = "0x"
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce)
            await expect(
                factory.createProxyWithNonce(singleton.address, initCode, saltNonce)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress, singleton.address)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(AddressZero)
            expect(await proxy.isInitialized()).to.be.eq(false)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode())
        })

        it('should emit event with initializing', async () => {
            const { factory, singleton } = await setupTests()
            const initCode = singleton.interface.encodeFunctionData("init", [])
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce)
            await expect(
                factory.createProxyWithNonce(singleton.address, initCode, saltNonce)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress, singleton.address)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(factory.address)
            expect(await proxy.isInitialized()).to.be.eq(true)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode())
        })

        it('should not be able to deploy same proxy twice', async () => {
            const { factory, singleton } = await setupTests()
            const initCode = singleton.interface.encodeFunctionData("init", [])
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce)
            await expect(
                factory.createProxyWithNonce(singleton.address, initCode, saltNonce)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress, singleton.address)
            await expect(
                factory.createProxyWithNonce(singleton.address, initCode, saltNonce)
            ).to.be.revertedWith("Create2 call failed")
        })
    })

    describe("createProxyWithCallback", async () => {

        const saltNonce = 42

        it('check callback is invoked', async () => {
            const { factory, mock, singleton } = await setupTests()
            let callback = await hre.ethers.getContractAt("IProxyCreationCallback", mock.address)
            const initCode = singleton.interface.encodeFunctionData("init", [])

            const proxyAddress = await calculateProxyAddressWithCallback(factory, singleton.address, initCode, saltNonce, mock.address)
            await expect(
                factory.createProxyWithCallback(singleton.address, initCode, saltNonce, mock.address)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress, singleton.address)

            expect(await mock.callStatic.invocationCount()).to.be.deep.equal(BigNumber.from(1))

            let callbackData = callback.interface.encodeFunctionData("proxyCreated", [proxyAddress, factory.address, initCode, saltNonce])
            expect(await mock.callStatic.invocationCountForMethod(callbackData)).to.be.deep.equal(BigNumber.from(1))

        })

        it('check callback error cancels deployment', async () => {
            const { factory, mock, singleton } = await setupTests()
            const initCode = "0x"
            let tx = await mock.givenAnyRevert()
            await tx.wait()
            await expect(
                factory.createProxyWithCallback(singleton.address, initCode, saltNonce, mock.address),
                "Should fail if callback fails"
            ).to.be.reverted

            tx = await mock.reset()
            await tx.wait()
            // Should be successfull now
            const proxyAddress = await calculateProxyAddressWithCallback(factory, singleton.address, initCode, saltNonce, mock.address)
            await expect(
                factory.createProxyWithCallback(singleton.address, initCode, saltNonce, mock.address)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress, singleton.address)
        })

        it('should work without callback', async () => {
            const { factory, singleton } = await setupTests()
            const initCode = "0x"
            const proxyAddress = await calculateProxyAddressWithCallback(factory, singleton.address, initCode, saltNonce, AddressZero)
            await expect(
                factory.createProxyWithCallback(singleton.address, initCode, saltNonce, AddressZero)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress, singleton.address)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(AddressZero)
            expect(await proxy.isInitialized()).to.be.eq(false)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode())
        })
    })

    describe("calculateCreateProxyWithNonceAddress", async () => {

        const saltNonce = 4242

        it('should return the calculated address in the revert message', async () => {
            const { factory, singleton } = await setupTests()
            const initCode = "0x"
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce)
            await expect(
                factory.callStatic.calculateCreateProxyWithNonceAddress(singleton.address, initCode, saltNonce)
            ).to.be.reverted
            // Currently ethers provides no good way to grab the result directly from the factory
            const data = factory.interface.encodeFunctionData("calculateCreateProxyWithNonceAddress", [singleton.address, initCode, saltNonce])
            const response = await singleton.callStatic.forward(factory.address, data)
            expect(proxyAddress).to.be.eq(getAddress(response.slice(138, 178)))
        })
    })
})
