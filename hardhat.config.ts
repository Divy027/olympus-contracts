
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
    goerli: 5,
    hardhat: 56,
    kovan: 42,
    mainnet: 1,
    rinkeby: 4,
    ropsten: 3,
    "base-sepolia": 84532,
    "bnb-testnet": 97
};

// Ensure that we have all the environment variables we need.
const privateKey = process.env.PRIVATE_KEY ?? "NO_PRIVATE_KEY";
// Make sure node is setup on Alchemy website
const alchemyApiKey = process.env.ALCHEMY_API_KEY ?? "NO_ALCHEMY_API_KEY";

function getChainConfig(network: keyof typeof chainIds): NetworkUserConfig {
    const url = `https://${network}.g.alchemy.com/v2/${alchemyApiKey}`;
    return {
        accounts: [`${privateKey}`],
        chainId: chainIds[network],
        url,
    };
}

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    gasReporter: {
        currency: "USD",
        enabled: process.env.REPORT_GAS ? true : false,
        excludeContracts: [],
        src: "./contracts",
    },
    networks: {
        hardhat: {
            forking: {
                url: `https://bsc-mainnet.infura.io/v3/c235679ca9984480acd9f33f5cf7510f`,
            },
            chainId: chainIds.hardhat,
            accounts: {
                
                accountsBalance: "10000000000000000000000", 
              },
        },
        // Uncomment for testing. Commented due to CI issues
        //mainnet: getChainConfig("mainnet"),
        // rinkeby: getChainConfig("rinkeby"),
        // ropsten: getChainConfig("ropsten"),
        baseSepolia: getChainConfig("base-sepolia"),
        bnb: getChainConfig("bnb-testnet")
    },
    paths: {
        artifacts: "./artifacts",
        cache: "./cache",
        sources: "./contracts",
        tests: "./test",
        deploy: "./scripts/deploy",
        deployments: "./deployments",
    },
    solidity: {
        compilers: [
            {
                version: "0.8.15",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    },
                },
            },
            {
                version: "0.8.10",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    },
                },
            },
            {
                version: "0.8.10",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    },
                },
            },
            {
                version: "0.7.5",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    },
                },
            },
            {
                version: "0.5.16",
            },
            {
                version: "0.8.10",
                settings: {
                    metadata: {
                        bytecodeHash: "none",
                    },
                    optimizer: {
                        enabled: true,
                        runs: 800,
                    },
                },
            },
        ],
        settings: {
            outputSelection: {
                "*": {
                    "*": ["storageLayout"],
                },
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        daoMultisig: {
            // mainnet
            1: "0x245cc372C84B3645Bf0Ffe6538620B04a217988B",
        },
    },
    
   
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
        customChains: [
          {
            network: "baseSepolia",
            chainId: 84532,
            urls: {
              apiURL: "https://api.etherscan.io/v2/api?chainid=84532",
              browserURL: "https://sepolia.basescan.org/"
            }
          }
        ]
      },
    mocha: {
        timeout: 1000000,
    },
};

export default config;