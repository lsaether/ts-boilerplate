import jimp from "jimp";
import * as fs from "fs";
//@ts-ignore
import * as NodeWebcam from "node-webcam";
//@ts-ignore
import QrReader from "qrcode-reader";
import readline from "readline";

/**
 * Asks a question the commandline and awaits a response.
 * @param query The question to ask the user of the program.
 */
export const askQuestion = (query: string): Promise<string> => {
  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
      rl.close();
      resolve(ans);
  }));
}

export const captureWebcam = (filename: string): Promise<string> => {
  const webcam = NodeWebcam.create({});

  return new Promise((resolve, reject) => {
    webcam.capture(`${filename}.jpeg`, (err: any, path: any) => {
      if (err) {
        reject(`Webcam error: \n${err}`);
      }

      const buffer = fs.readFileSync(path);
      jimp.read(buffer, (err: any, image: any) => {
        if (err) {
          reject(`Jimp error: \n${err}`);
        }

        const qrReader = new QrReader();
        qrReader.callback = (err: any, res: any) => {
          if (err) {
            return reject(`QR-Reader error: \n${err}`);
          }
          if (!res) {
            return reject(`QR-Reader error: No QR code found in the picture.`);
          }

          return resolve(res.result);
        }
        qrReader.decode(image.bitmap);
      });
    });
  });
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
}
