# RAG Evaluation Report

- Dataset: D:\study\mzx\项目\东方国信\通用agent平台\tests\data\rag_eval_dataset.json
- Samples: 50
- Embedding model: D:\study\mzx\项目\东方国信\通用agent平台\models\embedding

说明：本报告是固定数据集上的离线语义检索基线，使用本地 sentence-transformers 模型生成结果；当前本地演示默认使用 `EMBEDDING_PROVIDER=mock`，两者不能直接比较。切换 Provider 后应重新生成文档向量。

## Retrieval metrics

| Metric | Result |
|---|---:|
| Recall@5 | 98.00% |
| Recall@10 | 100.00% |
| MRR | 0.8956 |
| Average retrieval time | 55.64 ms/query |

Recall@K measures whether the correct document appears in the first K results.
MRR rewards systems that rank the correct document nearer to first place.
