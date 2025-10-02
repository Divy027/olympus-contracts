const { ethers } = require("hardhat");
const { formatUnits, parseUnits } = ethers.utils;

// ========================================================================================
//                                    CONFIGURATION
// ========================================================================================

// --- Blockchain Network Addresses (Base Sepolia) ---
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const UNISWAP_FACTORY= "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e"
const UNISWAP_V2_ROUTER_ADDRESS = "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602";

// --- Your Deployed Protocol Addresses ---
const PONZI_ADDRESS = "0xcbBE47404cAb8D28BDb82085043ca4E1Db2A930F";        // ⚠️ PASTE YOUR ADDRESS
const TREASURY_ADDRESS = "0xE2Bf0fE73211Ef83d8021D277Ed5E8FEd076e857";      // ⚠️ PASTE YOUR ADDRESS
const BOND_DEPOSITORY_ADDRESS = "0x86BEd80c1320806aA20189CC76830690A9a7974e"; // ⚠️ PASTE YOUR ADDRESS
const BONDING_CALCULATOR_ADDRESS = "0x925834ACdcada4DF848A544761a12D2Ef16Cc5c9"; // ⚠️ PASTE YOUR ADDRESS
const STAKING_DISTRIBUTOR_ADDRESS = "0x4Ab98913C4227C1da6a2E9Fe455d16097D1a9E5a"; // ⚠️ PASTE YOUR ADDRESS

// --- Liquidity & Bond Configuration ---
// This sets the initial market price. Example: 1 ETH = 1,0000 PONZI.
const ETH_TO_ADD = "0.01";
const PONZI_TO_ADD = "100";

// LP Bond Market Parameters
const VESTING_TERM_DAYS = 5;
const MARKET_DURATION_DAYS = 90;
const LP_TOKENS_TO_ACQUIRE = "1"; // Goal: Acquire 1 full LP token. Start small.

// ========================================================================================

// You likely won't need to change anything below this line.

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`Executing with wallet: ${deployer.address}`);
    console.log("----------------------------------------------------------");

    // Get contract instances
    const weth = await ethers.getContractAt("IWETH", WETH_ADDRESS);
    const ponzi = await ethers.getContractAt("PonziERC20", PONZI_ADDRESS);
    const router = await ethers.getContractAt("IUniswapV2Router", UNISWAP_V2_ROUTER_ADDRESS);
    const factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_FACTORY);
    const treasury = await ethers.getContractAt("PonziTreasury", TREASURY_ADDRESS);
    const bondDepository = await ethers.getContractAt("OlympusBondDepositoryV2", BOND_DEPOSITORY_ADDRESS);
    const stakingDistributor = await ethers.getContractAt("Distributor", STAKING_DISTRIBUTOR_ADDRESS);

    // ========================================================================================
    //                         STEP 1: CREATE THE LIQUIDITY POOL
    // ========================================================================================
    console.log("PHASE 1: Creating the PONZI-WETH Liquidity Pool...");

    // 1a. Wrap ETH to get WETH
    const ethAmount = ethers.utils.parseEther(ETH_TO_ADD);
    console.log(`\n-> Wrapping ${ETH_TO_ADD} ETH into WETH...`);
    const wrapTx = await weth.deposit({ value: ethAmount });
    await wrapTx.wait();
    console.log("✅ WETH received.");

    // 1b. Approve the Uniswap Router to spend both tokens
    const ponziAmount = parseUnits(PONZI_TO_ADD, 9);
    console.log(`\n-> Approving Router to spend ${formatUnits(ponziAmount, 9)} PONZI...`);
    const approvePonziTx = await ponzi.approve(router.address, ponziAmount);
    await approvePonziTx.wait();
    console.log("✅ PONZI approved.");

    console.log(`-> Approving Router to spend ${formatUnits(ethAmount, 18)} WETH...`);
    const approveWethTx = await weth.approve(router.address, ethAmount);
    await approveWethTx.wait();
    console.log("✅ WETH approved.");

    // 1c. Add Liquidity
    console.log("\n-> Calling addLiquidity on the Router...");
    const addLiquidityTx = await router.addLiquidity(
        ponzi.address,
        weth.address,
        ponziAmount,
        ethAmount,
        0, // amountAMin (no slippage protection on initial creation)
        0, // amountBMin
        deployer.address,
        Math.floor(Date.now() / 1000) + 60 * 10 // 10 minute deadline
    );
    await addLiquidityTx.wait();
    console.log("✅ Liquidity added! Pool is now live.");

    // 1d. Get and verify the new LP Token address
    let lpTokenAddress = await factory.getPair(ponzi.address, weth.address);
    console.log(`\n*** Your PONZI-WETH LP Token Address is: ${lpTokenAddress} ***`);

    const lpToken = await ethers.getContractAt("IUniswapV2Pair", lpTokenAddress);
    const lpBalance = await lpToken.balanceOf(deployer.address);
    console.log(`   Your wallet now holds ${formatUnits(lpBalance, 18)} LP tokens.`);
    console.log("----------------------------------------------------------");

//     // ========================================================================================
//     //                           STEP 2: ENABLE LP TOKEN IN TREASURY
//     // ========================================================================================
    console.log("PHASE 2: Enabling the new LP Token in the Treasury...");
   ///lpTokenAddress = "0x97f97c2B32C84302AD5D2C400fF124284e045F0C"
    // The deployer is the governor, so it can call `enable`.
    console.log(`\n-> Calling 'enable' on Treasury for LIQUIDITYTOKEN (enum 5)...`);
    const enableTx = await treasury.enable(
        5, // enum for LIQUIDITYTOKEN
        lpTokenAddress,
        BONDING_CALCULATOR_ADDRESS
    );

    await enableTx.wait()

    const enablmaineTx = await treasury.enable(
        4, // enum for LIQUIDITYDepositor
       deployer.address,
       ethers.constants.AddressZero
    );
    await enablmaineTx.wait();
    console.log("✅ LP Token is now a permitted asset for bonding.");
    console.log("----------------------------------------------------------");

    async function getAllPools(distributorContract) {
        const allPools = [];
        let index = 0;
        try {
            while (true) {
                const poolAddress = await distributorContract.pools(index);
                allPools.push(poolAddress);
                index++;
            }
        } catch (e) {
            // This error is expected when we try to access an index that is out of bounds.
            // It means we have successfully retrieved all the elements.
        }
        return allPools;
    }

    const pools = await getAllPools(stakingDistributor);
    console.log("POOLS",pools)
    const pooltx = await stakingDistributor.setPools([lpTokenAddress, ...pools]);
    await pooltx.wait();

    // ========================================================================================
    //                           STEP 3: CREATE THE LP BOND MARKET
    // ========================================================================================
    console.log("PHASE 3: Creating the LP Bond Market in the Bond Depository...");

    const latestBlock = await ethers.provider.getBlock("latest");
    const lpMarketCapacity = parseUnits(LP_TOKENS_TO_ACQUIRE, 18);
    const lpInitialBondPrice = "1000000000"; // Price of 1 (9 decimals), creates a natural discount
    const vestingTermInSeconds = VESTING_TERM_DAYS * 24 * 60 * 60;
    const conclusionTime = latestBlock.timestamp + (MARKET_DURATION_DAYS * 24 * 60 * 60);

    console.log("\n-> Calling 'create' on the Bond Depository...");
    const createMarketTx = await bondDepository.create(
        lpTokenAddress,
        [lpMarketCapacity, lpInitialBondPrice, "15000"], // Wide 15% buffer for volatility
        [true, true], // IMPORTANT: capacityInQuote must be TRUE for LP bonds
        [vestingTermInSeconds, conclusionTime],
        ["86400", "3600"] // Ideal pacing: 1 day, Tune frequency: 1 hour
    );
    await createMarketTx.wait();
    console.log("✅ PONZI-WETH LP Bond Market is now live!");
    console.log("----------------------------------------------------------\n");
    console.log("🚀 LP BOND LAUNCH COMPLETE! 🚀");



    // const poolwtx = await stakingDistributor.setPools([lpTokenAddress]);
    // await poolwtx.wait();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("An error occurred:", error);
        process.exit(1);
    });


