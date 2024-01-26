import { Contract, Signer } from "ethers";
import { Safe, SafeL2 } from "../../typechain-types";
export declare const defaultTokenCallbackHandlerDeployment: () => Promise<import("hardhat-deploy/dist/types").Deployment>;
export declare const defaultTokenCallbackHandlerContract: () => Promise<import("../../typechain-types").TokenCallbackHandler__factory>;
export declare const compatFallbackHandlerDeployment: () => Promise<import("hardhat-deploy/dist/types").Deployment>;
export declare const compatFallbackHandlerContract: () => Promise<import("../../typechain-types").CompatibilityFallbackHandler__factory>;
export declare const getSafeSingleton: () => Promise<Contract>;
export declare const getSafeSingletonContract: () => Promise<import("../../typechain-types").Safe__factory>;
export declare const getSafeL2SingletonContract: () => Promise<import("../../typechain-types").SafeL2__factory>;
export declare const getSafeSingletonContractFromEnvVariable: () => Promise<import("../../typechain-types").Safe__factory | import("../../typechain-types").SafeL2__factory>;
export declare const getSafeSingletonAt: (address: string) => Promise<Safe | SafeL2>;
export declare const getFactoryContract: () => Promise<import("../../typechain-types").SafeProxyFactory__factory>;
export declare const getFactory: () => Promise<import("../../typechain-types").SafeProxyFactory>;
export declare const getFactoryAt: (address: string) => Promise<import("../../typechain-types").SafeProxyFactory>;
export declare const getSimulateTxAccessor: () => Promise<import("../../typechain-types").SimulateTxAccessor>;
export declare const getMultiSend: () => Promise<import("../../typechain-types").MultiSend>;
export declare const getMultiSendCallOnly: () => Promise<import("../../typechain-types").MultiSendCallOnly>;
export declare const getCreateCall: () => Promise<import("../../typechain-types").CreateCall>;
export declare const migrationContract: () => Promise<import("../../typechain-types").Migration__factory>;
export declare const migrationContractTo150: () => Promise<import("../../typechain-types").Safe150Migration__factory>;
export declare const migrationContractFrom130To141: () => Promise<import("../../typechain-types").Safe130To141Migration__factory>;
export declare const getMock: () => Promise<import("../../typechain-types").MockContract & {
    deploymentTransaction(): import("ethers").ContractTransactionResponse;
}>;
export declare const getSafeTemplate: (saltNumber?: string) => Promise<Safe | SafeL2>;
export declare const getSafeWithOwners: (owners: string[], threshold?: number, fallbackHandler?: string, logGasUsage?: boolean, saltNumber?: string) => Promise<Safe | SafeL2>;
export declare const getSafeWithSingleton: (singleton: Safe | SafeL2, owners: string[], threshold?: number, fallbackHandler?: string, saltNumber?: string) => Promise<Safe | SafeL2>;
export declare const getTokenCallbackHandler: (address?: string) => Promise<import("../../typechain-types").TokenCallbackHandler>;
export declare const getCompatFallbackHandler: (address?: string) => Promise<import("../../typechain-types").CompatibilityFallbackHandler>;
export declare const getSafeProxyRuntimeCode: () => Promise<string>;
export declare const getDelegateCaller: () => Promise<import("../../typechain-types").DelegateCaller & {
    deploymentTransaction(): import("ethers").ContractTransactionResponse;
}>;
export declare const compile: (source: string) => Promise<{
    data: string;
    interface: any;
}>;
export declare const deployContract: (deployer: Signer, source: string) => Promise<Contract>;
