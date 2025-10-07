const { ethers } = require("hardhat");
const hre = require("hardhat"); 
const { formatUnits, parseUnits } = ethers.utils;

async function verifyContract(address, constructorArguments) {
    //console.log(`- Verifying contract at ${address}...`);
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: constructorArguments,
      });
      console.log(`✅ Verified`);
    } catch (e) {
      if (e.message.toLowerCase().includes("already verified")) {
       // console.log(`- Already verified`);
      } else {
        //console.error(`- Verification error:`, e.message);
      }
    }
  }
  

async function main() {
    // ========================================================================================
    //                                    CONFIGURATION
    // ========================================================================================
    
    const [deployer] = await ethers.getSigners();

   
    const USDC_ADDRESS = "0xcbBeC25F61A2ca9194FBacFb09e9bE64812bfccD"; 
    const USDT_ADDRESS = "0x48aB90b34F13589e2e08fF8942Cda0f6f8bE3DbE"; 

    // Staking and Rebase Configuration
    const EPOCH_LENGTH_IN_SECONDS = 3600; // 1 hr
    const INITIAL_REWARD_RATE = "2860"; // 0.5% -> 5000 / 1,000,000 = 0.005
    const KEEPER_BOUNTY = parseUnits("1", 9); // 1 Loop (assuming 9 decimals)
    
    console.log("Deploying contracts with the account: " + deployer.address);
    console.log("----------------------------------------------------------");
    
    // ========================================================================================
    //                                  PHASE 1: DEPLOYMENT
    // ========================================================================================
    console.log("PHASE 1: Starting contract deployments...");

 
    const Authority = await ethers.getContractFactory("LoopAuthority");
    const authority = await Authority.deploy(deployer.address, deployer.address, deployer.address, deployer.address);
    await authority.deployed();
    console.log("✅ Authority deployed to:", authority.address);
    await verifyContract(authority.address, [deployer.address, deployer.address, deployer.address, deployer.address]);

    
    // 2. Deploy Your Tokens
    const loop = await ethers.getContractFactory("LoopERC20"); 
    const Loop = await loop.deploy(authority.address);
    await Loop.deployed();
    console.log("✅ Loop Token deployed to:", Loop.address);
    await verifyContract(Loop.address, [authority.address]);

    const SLoop = await ethers.getContractFactory("sLoop"); 
    const sLoop = await SLoop.deploy();
    await sLoop.deployed();
    console.log("✅ sLoop Token deployed to:", sLoop.address);
    await verifyContract(sLoop.address, []);

    const GLoop = await ethers.getContractFactory("gLoop");
    const gLoop = await GLoop.deploy(deployer.address, sLoop.address);
    await gLoop.deployed();
    console.log("✅ gLoop Token deployed to:", gLoop.address);
    await verifyContract(gLoop.address, [deployer.address, sLoop.address]);

    // 3. Deploy Treasury (The Vault)
    const Treasury = await ethers.getContractFactory("LoopTreasury");
    const treasury = await Treasury.deploy(Loop.address, "0", authority.address);
    await treasury.deployed();
    console.log("✅ Treasury deployed to:", treasury.address);
    await verifyContract(treasury.address, [Loop.address, "0", authority.address]);

    // 4. Deploy Staking Contract
    const latestBlock = await ethers.provider.getBlock("latest");
    const Staking = await ethers.getContractFactory("OlympusStaking");
    const staking = await Staking.deploy(
        Loop.address,
        sLoop.address,
        gLoop.address, 
        EPOCH_LENGTH_IN_SECONDS,
        "1", // First epoch number
        latestBlock.timestamp,
        authority.address
    );
    await staking.deployed();
    console.log("✅ Staking deployed to:", staking.address);
    await verifyContract(staking.address, [ Loop.address,
        sLoop.address,
        gLoop.address, 
        EPOCH_LENGTH_IN_SECONDS,
        "1", // First epoch number
        latestBlock.timestamp, // First epoch time
        authority.address]);

    // 5. Deploy Distributor (The Reward Calculator)
    const Distributor = await ethers.getContractFactory("Distributor");
    const distributor = await Distributor.deploy(
        treasury.address,
        Loop.address,
        staking.address,
        authority.address,
        INITIAL_REWARD_RATE
    );
    await distributor.deployed();
    console.log("✅ Distributor deployed to:", distributor.address);
    await verifyContract(distributor.address, [ treasury.address,
        Loop.address,
        staking.address,
        authority.address,
        INITIAL_REWARD_RATE]);

    // 6. Deploy Bonding Calculator (For LP Bonds)
    const BondingCalculator = await ethers.getContractFactory("OlympusBondingCalculator");
    const bondingCalculator = await BondingCalculator.deploy(Loop.address);
    await bondingCalculator.deployed();
    console.log("✅ BondingCalculator deployed to:", bondingCalculator.address);
   await verifyContract(bondingCalculator.address, [Loop.address]);

    // 7. Deploy Bond Depository (The Marketplace)
    const BondDepository = await ethers.getContractFactory("OlympusBondDepositoryV2");
    const bondDepository = await BondDepository.deploy(
        authority.address,
        Loop.address,
        gLoop.address, // gLoop address
        staking.address,
        treasury.address
    );
    await bondDepository.deployed();
    console.log("✅ BondDepositoryV2 deployed to:", bondDepository.address);
    await verifyContract(bondDepository.address, [authority.address,
        Loop.address,
        gLoop.address, // gLoop address
        staking.address,
        treasury.address]);

    console.log("----------------------------------------------------------");

    // ========================================================================================
    //                               PHASE 2: CONFIGURATION
    // ========================================================================================
    console.log("PHASE 2: Starting contract configuration...");

   



    console.log("- Temporarily granting minting role to deployer...");
    
    // const initialSupply = parseUnits("10000", 9); 
    // await Loop.mint(deployer.address, initialSupply);
    // console.log(`- Minted ${formatUnits(initialSupply, 9)} Loop to deployer for initial liquidity.`);


    // 2. Set Treasury Permissions
    // 8 = REWARDMANAGER, 0 = RESERVEDEPOSITOR, 4 = LIQUIDITYDEPOSITOR, 2 = RESERVETOKEN, 5 = LIQUIDITYTOKEN, 9 = SLoop
    await treasury.enable("8", distributor.address, ethers.constants.AddressZero);

       // 4. Configure Staking and Distributor contracts
    await staking.setDistributor(distributor.address);
    await sLoop.setIndex(parseUnits("1", 9)); // Initial index is 1
    //await sLoop.setIndex("7675210820");
    await sLoop.setgLoop(gLoop.address);
    console.log("✅ sLoop initialized.");
    await sLoop.initialize(staking.address, treasury.address);

    await gLoop.setApproved(staking.address);

    await distributor.setBounty(KEEPER_BOUNTY);

    await treasury.enable("9",sLoop.address, ethers.constants.AddressZero);
    await treasury.enable("0", deployer.address, ethers.constants.AddressZero);
    await treasury.enable("3", deployer.address, ethers.constants.AddressZero);

    await treasury.enable("8", bondDepository.address, ethers.constants.AddressZero);
    await treasury.enable("0", bondDepository.address, ethers.constants.AddressZero);
   
    await treasury.enable("4", bondDepository.address, ethers.constants.AddressZero);
    await treasury.enable("2", USDC_ADDRESS, ethers.constants.AddressZero);
    await treasury.enable("2", USDT_ADDRESS, ethers.constants.AddressZero);
    
    // await treasury.enable("5", YOUR_LP_TOKEN_ADDRESS, bondingCalculator.address);
    console.log("✅ Treasury permissions set.");
    
    // 3. Transfer Vault role to Treasury
    
    await authority.pushVault(treasury.address, true);
    console.log("✅ Authority vault role transferred to Treasury.");

 
    //await staking.setWarmupLength("0");
   
    console.log("✅ Staking and Distributor configured.");

    console.log("----------------------------------------------------------");

    console.log("PHASE 3: Seeding Treasury and creating initial supply...");

    const usdcContract = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", USDC_ADDRESS);

    
    const surplusAmount = parseUnits("1000", 6);
    const surplusValueInLoop = await treasury.tokenValue(USDC_ADDRESS, surplusAmount);

    const balance = await usdcContract.balanceOf(deployer.address);
    console.log("balance of usdc:",formatUnits(balance, 6))

    console.log('suplus value in Loop',surplusValueInLoop);
    
    console.log(`- Approving treasury for surplus deposit...`);
    const approvetx = await usdcContract.approve(treasury.address, surplusAmount);
    console.log(`- Depositing ${formatUnits(surplusAmount, 6)} USDC to create a surplus...`);
    await approvetx.wait();
    const deposit = await treasury.deposit(surplusAmount, USDC_ADDRESS, surplusValueInLoop);

    await deposit.wait();

    // STEP 2: Deposit funds to create the INITIAL SUPPLY for the deployer.
    // We deposit 10,000 USDC with zero profit, which will mint 10,000 Loop to the deployer.
    const supplyAmount = parseUnits("10000", 6);

    console.log(`- Approving treasury for supply deposit...`);
    const approve2 = await usdcContract.approve(treasury.address, supplyAmount);
    await approve2.wait();
    console.log(`- Depositing ${formatUnits(supplyAmount, 6)} USDC to create initial supply...`);
    const deposit2 = await treasury.deposit(supplyAmount, USDC_ADDRESS, 0);
    await deposit2.wait();

    // // Revoke deployer's deposit permission for security
    // await treasury.disable("0", deployer.address);
    console.log("✅ Treasury seeded and deployer received initial supply.");

    // Final check of the protocol state
    const excessReserves = await treasury.excessReserves();
    const totalReserves = await treasury.totalReserves();
    const totalSupply = await Loop.totalSupply();
    const deployerLoopBalance = await Loop.balanceOf(deployer.address);

    console.log(`************************************************************`);
    console.log(`*               FINAL PROTOCOL STATE                       *`);
    console.log(`************************************************************`);
    console.log(`* Total Reserves: ${formatUnits(totalReserves, 9)} Loop`);
    console.log(`* Total Supply:   ${formatUnits(totalSupply, 9)} Loop`);
    console.log(`* Excess Reserves: ${formatUnits(excessReserves, 9)} Loop`);
    console.log(`* Deployer's Loop: ${formatUnits(deployerLoopBalance, 9)} Loop`);
    console.log(`************************************************************`);


    // ========================================================================================
    //                        PHASE 3: CREATE FIRST BOND MARKET
    // ========================================================================================
    console.log("PHASE 3: Creating initial bond market...");
    
    // Example: Creating a bond market for USDC
    const fiveDaysInSeconds = 600; // 10 minutes
    const marketCapacity = parseUnits("250000", 6); 
    const initialBondPrice = "4500000000"; 
    const conclusionTime = latestBlock.timestamp + (30 * 24 * 60 * 60); // Market open for 30 days
    
    await bondDepository.create(
        USDC_ADDRESS,                           // _quoteToken
        [marketCapacity, initialBondPrice, "1000"], // _market: [capacity, price, buffer]
        [true, true],                           // _booleans: [capacityInQuote, fixedTerm]
        [fiveDaysInSeconds, conclusionTime],    // _terms: [vesting, conclusion]
        ["3600", "1800"]                           // _intervals: [depositInterval, tuneInterval]
    );
    console.log("✅ USDC bond market created.");



    console.log("----------------------------------------------------------");
    console.log("🚀 DEPLOYMENT AND CONFIGURATION COMPLETE! 🚀");

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });