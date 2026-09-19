import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import dotenv from "dotenv";

dotenv.config();

const REGION = process.env.AWS_REGION || "us-east-1";
const POLLY_ENGINE = process.env.POLLY_ENGINE || "standard";
const polly = new PollyClient({ region: REGION });

/**
 * Helper to convert an async iterable or readable stream to Buffer
 */
export async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export { polly, POLLY_ENGINE };
