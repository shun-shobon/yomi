import { createResource } from "solid-js";

import { clearTranslations, countTranslations } from "@/infra/storage/translation-cache";

export function CacheSection() {
  const [count, { mutate }] = createResource(countTranslations);
  const clear = async () => {
    await clearTranslations();
    mutate(0);
  };
  return (
    <section class="section">
      <h2>キャッシュ</h2>
      <div class="row">
        <div class="grow">保存済みの訳文 {count()?.toLocaleString() ?? "-"} 件</div>
        <button class="btn" disabled={!count()} onClick={() => void clear()}>
          キャッシュを消去
        </button>
      </div>
    </section>
  );
}
