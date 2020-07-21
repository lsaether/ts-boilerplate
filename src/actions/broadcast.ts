import { ApiPromise, WsProvider } from "@polkadot/api";

import { askQuestion, captureWebcam } from "../helpers";
import { SubmittableExtrinsic } from "@polkadot/api/types";

/**
 * Note: Currently broadcast is done as the main action. 
 * @param payloadObj 
 * @param wsEndpoint 
 */
const broadcast = async (payloadObj: any, wsEndpoint: string) => {
  const api = await ApiPromise.create({
    provider: new WsProvider(wsEndpoint),
  });

  if (!payloadObj) {
    // TODO: Read it from file.
  }
  const captureLoop = async (): Promise<string> => {
    await askQuestion("Hold up the QR code of the signed transaction from the Signer app in front of your webcam and press 'Enter' when you're ready to take a picture.");
    const result = await captureWebcam("broadcast");
    // console.log(result);
    return result;
  }

  let result;
  while (!result) {
    try {
      result = await captureLoop();
    } catch (err) {
      console.log(err);
      console.log("Error encountered while capturing webcame, please try again or `ctrl-c` to quit.");
    }
  }

  const { address, call, payload } = payloadObj;
  const extrinsic: SubmittableExtrinsic<'promise'> = call;
  extrinsic.addSignature(address, '0x' + result, payload);
  console.log("Signed transaction:", extrinsic.toJSON());
  // extrinsic.send();
}

export default broadcast;
