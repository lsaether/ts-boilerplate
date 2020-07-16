import program from "commander";
import { ApiPromise, WsProvider } from "@polkadot/api";
import * as Keyring from "@polkadot/keyring";
import * as util from "@polkadot/util";
import * as fs from "fs";
import ApiHandler from "./handler";

const start = async (opts: any) => {
  const { blockNum } = opts;

  const api = await ApiPromise.create({
    provider: new WsProvider("wss://kusama-rpc.polkadot.io/"),
  });

  const hash = await api.rpc.chain.getBlockHash(Number(blockNum));

  const keys = await api.query.system.account.keys();
  console.log("keysLength", keys.length);

  const supply = await api.query.balances.totalIssuance.at(hash);
  console.log("supply", supply.toString());
  
  let cont = false;
  for (const key of keys) {
    const maybeAccount = "0x" + key.toString().slice(-64);
    const account = Keyring.encodeAddress(util.hexToU8a(maybeAccount), 2);
    const vesting = await api.query.vesting.vesting(account);
    if (vesting.isSome) {
      console.log(account);
    }
    console.log(account);
    if (account === "GZhmVta94g8zhFdZXNSdN7HQT8ynqJ4iASp28ZhJ96LBa2e") {
      cont = true;
    }
    if (!cont) {
      continue;
    }
    try {
      const query = await api.query.democracy.votingOf.at(hash, account);
      const json: any = query.toJSON();
      const found = json.Direct.votes.find((vote: any) => vote[0] === 52);
      console.log(found);
      if (found) {
        fs.appendFileSync(
          `output.${blockNum}.csv`,
          `${account}\n${JSON.stringify(found)}\n${JSON.stringify(
            json.Direct.delegations
          )}\n\n`
        );
      }
    } catch (e) {
      console.error("ERR", e);
    }
  }
  console.log("finished");
  process.exit(0);
};

const slice = async () => {
  // const api = await ApiPromise.create({
  //   provider: new WsProvider("wss://kusama-rpc.polkadot.io/"),
  // });

  const read = fs.readFileSync("output.csv", { encoding: "utf-8" });
  const lines = read.split("\n");
  let ayeTotal = util.bnToBn(0);
  let nayTotal = util.bnToBn(0);
  let ayeTally = 0;
  let nayTally = 0;
  for (const line of lines) {
    if (!line) continue;
    try {
      const json = JSON.parse(line);
      if (Array.isArray(json)) {
        const [ref, voteObj] = json;
        if (ref !== 52) continue;
        const { vote, balance } = voteObj.Standard;
        if (vote[2] === "8") {
          const bn = util.bnToBn(balance);
          ayeTotal = ayeTotal.add(bn);
          ayeTally++;
        } else {
          const bn = util.bnToBn(balance);
          nayTotal = nayTotal.add(bn);
          nayTally++;
        }
      }
    } catch (e) {
      // console.error(e);
    }
  }

  console.log("Ayes");
  console.log("----");
  console.log(ayeTally);
  console.log(ayeTotal.toString());
  console.log("Nays");
  console.log("----");
  console.log(nayTally);
  console.log(nayTotal.toString());
};

/**
 * Tracks down what happened with 0xa974c739d6a0f8bbf598f8da986f6667b347eb78.
 */
const track = async () => {
  const api = await ApiPromise.create({
    provider: new WsProvider("wss://rpc.polkadot.io/"),
  });

  const ethAddr = "0xa974c739d6a0f8bbf598f8da986f6667b347eb78";

  const hash = await api.rpc.chain.getBlockHash(7500);
  let block = await api.rpc.chain.getBlock(hash);

  while (Number(block.block.header.number) > 0) {
    console.log(block.block.header.number.toNumber());
    const claim = await api.query.claims.claims.at(
      block.block.header.hash,
      ethAddr
    );
    console.log(claim.toString());

    block = await api.rpc.chain.getBlock(block.block.header.parentHash);
  }
};

const balanceCheck = async () => {
  const api = await ApiPromise.create({
    provider: new WsProvider("ws://localhost:9944"),
  });
  const handler = new ApiHandler(api);

  const hash = await api.rpc.chain.getBlockHash(341912);
  let block = await api.rpc.chain.getBlock(hash);

  while (Number(block.block.header.number) > 0) {
    console.log("Block", Number(block.block.header.number));
    await handler.ensureMeta(block.block.header.hash.toString());
    const totalIssuance = await handler.api.query.balances.totalIssuance.at(block.block.header.hash);
    const claimsTotal = await handler.api.query.claims.total.at(block.block.header.hash);
    const total = totalIssuance.add(util.hexToBn(claimsTotal.toHex()));
    fs.appendFileSync("balanceCheck.csv", `${block.block.header.number},${totalIssuance},${claimsTotal},${total}\n`);
    block = await api.rpc.chain.getBlock(block.block.header.parentHash);
  }
};

const allStaked = async () => {
  const api = await ApiPromise.create({
    provider: new WsProvider("ws://localhost:9944"),
  });

  // 1hJdgnAPSjfuHZFHzcorPnFvekSHihK9jdNPWHXgeuL7zaJ
  // 155NNzxAJrMzkUAM5QW9ad1p2t6XZo9idmFruZxzrvJGUCrZ

  let found = 0;
  const keys = await api.query.system.account.keys();
  for (const key of keys) {
    const maybeAccount = "0x" + key.toString().slice(-64);
    const account = Keyring.encodeAddress(util.hexToU8a(maybeAccount), 0);

    const data = await api.query.system.account(account);
    if (data.data.free.sub(data.data.feeFrozen).lte(util.bnToBn(0))) {
      console.log(`FOUND ${account}`);
      console.log(data.data.free.sub(data.data.feeFrozen).toString());

      found++;
      fs.appendFileSync('allStaked.csv', `${account},500000000\n`);
    }
  }

  console.log(`Total accounts: ${keys.length}`);
  console.log(`Found free balance <= 0.0005 DOTs: ${found}`);
}

const allClaims = async () => {
  const api = await ApiPromise.create({
    provider: new WsProvider("ws://localhost:9944"),
  });

  const keys = await api.query.claims.claims.keys();
  let total = util.bnToBn(0);
  for (const key of keys) {
    const ethAddr = '0x' + key.toString().slice(-40);
    const bal = await api.query.claims.claims(ethAddr);
    // console.log(bal.toString());
    console.log(ethAddr);
    total = total.add(util.bnToBn(bal.toString()));
  }


  console.log('got total', (await api.query.claims.total()).toString());
  console.log('calculated total', total.toString());
}

const getActualTotal = async () => {
  const api = await ApiPromise.create({
    provider: new WsProvider("wss://rpc.polkadot.io"),
  });

  let curEraIndex = 0;
  let okay = true;
  let totalUnclaimed = util.bnToBn(0);
  while (okay) {
    try {
      console.log("Current era:", curEraIndex);
      const eraPayout = await api.query.staking.erasValidatorReward(curEraIndex);
      if (eraPayout.isNone) {
        break;
      }
      console.log("Era payout:", eraPayout.toString());
      const erasPoints = await api.query.staking.erasRewardPoints(curEraIndex);
      const { total, individual } = erasPoints;
      if (total.toNumber() === 0) {
        okay = false;
        continue;
      }
      for (const val of Array.from(individual.keys())) {
        const individualAmt = individual.get(val);
        const share = individualAmt!.toBn().mul(util.bnToBn(eraPayout.toString())).div(total);

        const controller = await api.query.staking.bonded(val);
        if (controller.isNone && curEraIndex !== 0) {
          throw new Error("Stash doesn't have a controller");
        } else if (curEraIndex === 0) {
          continue;
        }
        const ledger = await api.query.staking.ledger(controller.unwrap());
        if (ledger.isNone) {
          console.log('No ledger found for:', val.toString());
        } else {
          const { claimedRewards } = ledger.unwrap();
          if (claimedRewards.indexOf(curEraIndex) === -1) {
            console.log("FOUND ONE | share:", share!.toString());
            totalUnclaimed = totalUnclaimed.add(share!);

          }
        }
      }
      curEraIndex++;
    } catch (err) {
      console.error(err);
      okay = false;
    }
  }

  console.log('total issuance', (await api.query.balances.totalIssuance()).toString());
  console.log('total claims', (await api.query.claims.total()).toString());

  console.log('total unclaimed', totalUnclaimed.toString());

  console.log("Finished");
  process.exit(0);
}

program
  .command("start")
  .option("--blockNum <number>", "Block number to pull the data for.", "2318399")
  .action(start);
program.command("slice").action(slice);
program.command("track").action(track);
program.command("balanceCheck").action(balanceCheck);
program.command("allStaked").action(allStaked);
program.command("allClaims").action(allClaims);
program.command("getActualTotal").action(getActualTotal);

program.parse(process.argv);
