import OpenAI, { APIError } from "openai";

import { ApiError } from "@/domain/api-error";
import type { ModelInfo } from "@/domain/models";
import type { ReasoningEffort } from "@/domain/settings";

import { FAST_SERVICE_TIER, toModelInfos, type SiwcModel } from "./models";

function createClient(token: string): OpenAI {
  return new OpenAI({
    apiKey: token,
    // 拡張の service worker はブラウザ環境と判定される。キーはユーザー本人の OAuth トークンで、第三者には渡らない
    dangerouslyAllowBrowser: true,
    // 再試行は refresh を挟む呼び出し側で制御する
    maxRetries: 0,
  });
}

export async function listModels(token: string): Promise<ModelInfo[]> {
  // SIWC の /models は data ではなく models 配列を返すため、SDK の models.list() ではなく汎用 get を使う
  const { models } = await withApiErrors(() =>
    createClient(token).get<{ models: SiwcModel[] }>("/models"),
  );
  return toModelInfos(models);
}

export interface StreamOptions {
  token: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  fast: boolean;
  instructions: string;
  input: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
}

/** SIWC は stream: true / store: false が必須 */
export async function streamResponse(opts: StreamOptions): Promise<void> {
  const stream = await withApiErrors(() =>
    createClient(opts.token).responses.create(
      {
        model: opts.model,
        instructions: opts.instructions,
        input: [{ role: "user", content: opts.input }],
        reasoning: { effort: opts.reasoningEffort },
        ...(opts.fast && { service_tier: FAST_SERVICE_TIER }),
        store: false,
        stream: true,
      },
      { signal: opts.signal },
    ),
  );
  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta":
        opts.onDelta(event.delta);
        break;
      case "response.completed":
        return;
      case "response.failed":
      case "response.incomplete": {
        const { error } = event.response;
        throw new ApiError(null, error?.code ?? null, error?.message ?? event.type);
      }
      case "error":
        throw new ApiError(null, event.code, event.message);
      default:
        break;
    }
  }
  throw new ApiError(null, null, "応答が途中で終了しました");
}

async function withApiErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof APIError) || typeof e.status !== "number") throw e;
    const message =
      e.requestID == null || e.requestID === ""
        ? e.message
        : `${e.message} (request id: ${e.requestID})`;
    throw new ApiError(e.status, e.code ?? null, message);
  }
}
