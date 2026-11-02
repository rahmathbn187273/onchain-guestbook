const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Guestbook", function () {
  let guestbook, alice, bob;

  beforeEach(async function () {
    [alice, bob] = await ethers.getSigners();
    guestbook = await ethers.deployContract("Guestbook");
    await guestbook.waitForDeployment();
  });

  it("starts with zero messages", async function () {
    expect(await guestbook.messageCount()).to.equal(0n);
  });

  it("posts a message and emits MessagePosted", async function () {
    await expect(guestbook.connect(alice).postMessage("Hello blockchain!"))
      .to.emit(guestbook, "MessagePosted")
      .withArgs(alice.address, 0, "Hello blockchain!", anyValue);

    const msg = await guestbook.getMessage(0);
    expect(msg.author).to.equal(alice.address);
    expect(msg.text).to.equal("Hello blockchain!");
  });

  it("increments the message count", async function () {
    await guestbook.connect(alice).postMessage("one");
    await guestbook.connect(bob).postMessage("two");
    expect(await guestbook.messageCount()).to.equal(2n);
  });

  it("rejects an empty message", async function () {
    await expect(guestbook.postMessage("")).to.be.revertedWith(
      "Message cannot be empty"
    );
  });

  it("rejects a message longer than the limit", async function () {
    const tooLong = "a".repeat(281);
    await expect(guestbook.postMessage(tooLong)).to.be.revertedWith(
      "Message too long (max 280 bytes)"
    );
  });

  it("returns recent messages newest first", async function () {
    await guestbook.postMessage("first");
    await guestbook.postMessage("second");
    await guestbook.postMessage("third");

    const recent = await guestbook.getRecentMessages(2);
    expect(recent.length).to.equal(2);
    expect(recent[0].text).to.equal("third");
    expect(recent[1].text).to.equal("second");
  });
});
