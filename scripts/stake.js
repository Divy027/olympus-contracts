const { ethers } = require("hardhat");
const { parseUnits } = ethers.utils;

async function main() {
    const [deployer] = await ethers.getSigners();

    // === PASTE YOUR DEPLOYED CONTRACT ADDRESSES HERE ===
    const ponziAddress = "0x9F1D07846b122a65C2911ee69f46B9700a74E038"; // Your PONZI token address
    const stakingAddress = "0x0850A515d51Fc56761B558Ff9129c45ACFef39fe"; // Your OlympusStaking address
    const sohm = "0x990A5c628991878B72CCce6f0fcf00BC6682526E";
    // ======================================================

    console.log(`Using deployer: ${deployer.address}`);

    // Get contract instances
    const ponzi = await ethers.getContractAt("PonziERC20", ponziAddress);
    const sponzi = await ethers.getContractAt("PonziERC20", sohm);
    const staking = await ethers.getContractAt("OlympusStaking", stakingAddress);

    // Define the amount to stake
    const amountToStake = parseUnits("100", 9); // Staking 100 PONZI

    const stakeBala = await sponzi.balanceOf(stakingAddress);
    console.log("Stake bal",ethers.utils.formatUnits(stakeBala, 9));

    // 1. Check initial balances and allowance
    const initialPonziBalance = await ponzi.balanceOf(deployer.address);
    console.log(`Initial PONZI balance: ${ethers.utils.formatUnits(initialPonziBalance, 9)}`);

    const initialAllowance = await ponzi.allowance(deployer.address, staking.address);
    console.log(`Initial allowance for Staking contract: ${ethers.utils.formatUnits(initialAllowance, 9)}`);

    // 2. Approve the Staking contract
    console.log(`\nApproving Staking contract to spend ${ethers.utils.formatUnits(amountToStake, 9)} PONZI...`);
    const approveTx = await ponzi.approve(staking.address, amountToStake );
    await approveTx.wait();
    console.log("✅ Approve transaction confirmed.");

    const newAllowance = await ponzi.allowance(deployer.address, staking.address);
    console.log(`New allowance is: ${ethers.utils.formatUnits(newAllowance, 9)}`);

    // 3. Stake the tokens
    console.log("\nStaking...");
    try {
        const stakeTx = await staking.stake(deployer.address, amountToStake, true, true);
        await stakeTx.wait();
        console.log("✅ STAKING SUCCESSFUL! Transaction hash:", stakeTx.hash);
    } catch (error) {
        console.error("❌ STAKING FAILED.");
        console.error("This confirms the issue is a contract-level interaction, likely the custom debt check in sPonzi.transfer.");
        console.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });