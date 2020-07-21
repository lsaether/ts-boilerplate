import { askQuestion, captureWebcam } from "../helpers";

const scanAddress = async () => {
  const captureLoop = async (): Promise<string> => {
    await askQuestion("Hold up the QR code for your Parity Signer account in front of your webcam and press 'Enter' when you're ready to take a picture.");
    const result = await captureWebcam("scanAddress");
    if (!result.startsWith("substrate")) {
      throw new Error("The QR code that was scanned does not contain a valid Address string.");
    }
    return result;
  }

  let result;
  while (!result) {
    try {
      result = await captureLoop();
    } catch (err) {
      console.log(err);
      console.log("Error encountered while capturing webcam, please try again or `ctrl-c` to quit.");
    }
  }

  const address = result.split(":")[1];
  console.log("\nSigner address:", address);
}

export default scanAddress;
