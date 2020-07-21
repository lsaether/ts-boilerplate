import { ApiPromise, WsProvider } from "@polkadot/api";
import qrcode from "@polkadot/react-qr/qrcode";
import { createSignPayload, createFrames } from "@polkadot/react-qr/util";
import { SignerPayload } from "@polkadot/types/interfaces";
import program from "commander";
import * as fs from "fs";
import * as http from "http";
//@ts-ignore
import opn from "opn";

import scanAddress from "./actions/scanAddress";
import broadcast from "./actions/broadcast";
import { sleep } from "./helpers";

const parse = (commaSeparated: string): string[] => {
  if (commaSeparated.indexOf(",") !== -1) {
    return commaSeparated.split(",");
  } else {
    return [commaSeparated];
  }
}

// function getQrString (value: Uint8Array): string {
//   const qr = qrcode(0, 'M');

//   // HACK See out qrcode stringToBytes override as used internally. This
//   // will only work for the case where we actuall pass `Bytes` in here
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   qr.addData(value as any, 'Byte');
//   qr.make();

//   return qr.createASCII(0, 2);
// }

function getDataUrl (value: Uint8Array): string {
  const qr = qrcode(0, 'M');

  // HACK See out qrcode stringToBytes override as used internally. This
  // will only work for the case where we actuall pass `Bytes` in here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  qr.addData(value as any, 'Byte');
  qr.make();

  return qr.createDataURL(4, 0);
}

type Options = {
  address: string;
  otherSigners: string,
  threshold: string;
  who: string;
  wsEndpoint: string;
}

const start = async (opts: Options) => {
  const { otherSigners, threshold, who, wsEndpoint } = opts;
  let { address } = opts;

  if (!address) {
    throw new Error("Must supply the signer address with the --address option. Please user `scanAddress` command first!");
  }
  if (!who) {
    throw new Error("Need to pass a --who <dot_address> option.");
  }

  const api = await ApiPromise.create({
    provider: new WsProvider(wsEndpoint),
  });

  const nonce = (await api.query.system.account(address)).nonce; 

  const signedBlock = await api.rpc.chain.getBlock();
  const options = {
    blockHash: signedBlock.block.header.hash,
    era: api.createType("ExtrinsicEra", {
      current: signedBlock.block.header.number,
      period: 200,
    }),
    nonce,
    blockNumber: signedBlock.block.header.number,
  };

  const innerCall = api.tx.purchase.payout(who);
  const call = api.tx.multisig.asMulti(threshold, parse(otherSigners), null, innerCall.toHex(), true, 2000000);

  //@ts-ignore
  const payload: SignerPayload = api.createType("SignerPayload", {
    genesisHash: api.genesisHash,
    runtimeVersion: api.runtimeVersion,
    version: api.extrinsicVersion,
    ...options,
    address: address,
    method: call.method,
  });

  const exPayload = api.createType("ExtrinsicPayload", payload.toPayload(), { version: payload.toPayload().version });
  const signPayload = createSignPayload(address, 2, exPayload.toU8a(), api.genesisHash);
  const frames = createFrames(signPayload);
  let dataUrl = getDataUrl(frames[0]);

  console.log("Opening the QR-codes in the browser.")
  const randomPort = Math.floor(7800 + Math.random() * 99);
  http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write(`<image src=${dataUrl} />`);
    res.end();
  }).listen(randomPort);
  opn(`http://localhost:${randomPort}`)
  await sleep(2000);

  // Write out the payload to use in the next script.
  const obj =  {
    address,
    call: call,
    payload: exPayload,
  };

  fs.writeFileSync("payload.json", JSON.stringify(obj));
  await broadcast(obj, wsEndpoint);

  process.exit(0);
};

program
  .command("start")
  .option("--address <signer>", "The address of the signer of the transactions.", "")
  .option("--who <dot_address>", "The Polkadot address to pay out.", "")
  .option("--otherSigners <[addr1,addr2,..>", "Comma-separated list of accounts that are other signers of the Msig.", "")
  .option("--threshold <number>", "The threshold of signers for the MultiSig.", "1")
  .option("--wsEndpoint <url>", "The WebSockets endpoint to connect.", "wss://rpc.polkadot.io")
  .action(start);

program
  .command("scanAddress")
  .description("Scans a Parity Signer address and prints it to the CLI for input into signing scripts.")
  .action(scanAddress);

// program
//   .command("broadcast")
//   .description("Broadcasts a transaction from the Signer QR code.")
//   .action(broadcast);

program.parse(process.argv);
