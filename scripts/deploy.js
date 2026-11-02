const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  const guestbook = await hre.ethers.deployContract("Guestbook");
  await guestbook.waitForDeployment();
  const address = await guestbook.getAddress();

  console.log("\n✅ Guestbook deployed to:", address);
  console.log("Etherscan: https://sepolia.etherscan.io/address/" + address);
  console.log("\nNext: paste this address into frontend/config.js (CONTRACT_ADDRESS)");
  console.log("Optional verify: npx hardhat verify --network sepolia " + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
