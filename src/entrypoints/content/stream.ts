import { browser, type Browser } from "#imports";
import { TranslateFailure } from "@/domain/failure";
import {
  TRANSLATE_PORT,
  type TranslateEvent,
  type TranslateRequest,
} from "@/infra/messaging/protocol";

export interface StreamHandle {
  /** 成功で resolve、失敗で TranslateFailure、cancel() で StreamCancelled を reject する */
  done: Promise<void>;
  cancel: () => void;
}

export class StreamCancelled extends Error {}

/** background に翻訳を依頼する。port を切断すると background 側の fetch も中断される */
export function requestTranslation(
  req: TranslateRequest,
  onDelta: (text: string) => void,
): StreamHandle {
  const { promise: done, resolve, reject } = Promise.withResolvers<void>();
  let port: Browser.runtime.Port;
  try {
    port = browser.runtime.connect({ name: TRANSLATE_PORT });
  } catch {
    // 拡張の更新・再読み込み後に残った content script では connect が例外を投げる
    reject(
      new TranslateFailure(
        "extension_reloaded",
        "拡張機能が更新されました。ページを再読み込みしてください。",
      ),
    );
    return { done, cancel: () => {} };
  }

  let finished = false;
  const finish = (settle: () => void) => {
    if (finished) return;
    finished = true;
    port.disconnect();
    settle();
  };

  port.onMessage.addListener((event: TranslateEvent) => {
    switch (event.type) {
      case "delta":
        onDelta(event.text);
        break;
      case "done":
        finish(resolve);
        break;
      case "error":
        finish(() => reject(TranslateFailure.from(event.failure)));
        break;
    }
  });
  port.onDisconnect.addListener(() => {
    finish(() => reject(new TranslateFailure("other", "拡張機能との接続が切れました")));
  });
  port.postMessage(req);

  return { done, cancel: () => finish(() => reject(new StreamCancelled())) };
}
