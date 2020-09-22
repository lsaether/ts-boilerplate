import program from "commander";
import { ApiPromise, WsProvider } from "@polkadot/api";
import encodeAddress from "@polkadot/util-crypto/address/encode";
import { bnToBn } from "@polkadot/util";

const start = async () => {
  const api = await ApiPromise.create({
    provider: new WsProvider("wss://rpc.polkadot.io"),
  });

  let totalUnlocking = bnToBn(0);
  let canBeWithdrawn = bnToBn(0);

  const ledgers = await api.query.staking.ledger.keys();
  const currentEra = await api.query.staking.activeEra();
  const curIndex = currentEra.unwrap().index.toNumber();

  for (const entry of ledgers) {
    const pubkey = "0x" + entry.toString().slice(-64);
    const addr = encodeAddress(pubkey, 0);
    console.log("Getting data for:", addr);
    const ledger = await api.query.staking.ledger(addr);
    const { unlocking } = ledger.toJSON() as any;

    if (unlocking.length) {
      for (const unlockChunk of unlocking) {
        const { value, era } = unlockChunk;
        totalUnlocking = totalUnlocking.add(bnToBn(value));
        if (era <= curIndex) {
          canBeWithdrawn = canBeWithdrawn.add(bnToBn(value));
        }
      }
    }
  }

  console.log(`At era ${curIndex}`);
  console.log(`Total unlocking: ${totalUnlocking.toString()}`);
  console.log(`Can be withdrawn: ${canBeWithdrawn.toString()}`);
};

program.command("start").action(start);

program.parse(process.argv);
