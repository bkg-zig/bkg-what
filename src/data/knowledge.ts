import { KnowledgeEntry } from '../types';

export const knowledgeBase: KnowledgeEntry[] = [
  {
    id: 'kb-001',
    title: 'Attention Is All You Need (Transformers)',
    category: 'Architecture',
    content: 'The Transformer architecture revolutionized NLP by completely replacing recurrent layers with self-attention mechanisms, allowing for massive parallelization and tracking of long-range dependencies in text.',
    source: 'Vaswani et al., 2017 (NeurIPS)',
    url: 'https://arxiv.org/abs/1706.03762'
  },
  {
    id: 'kb-002',
    title: 'Scaling Laws for Neural Language Models',
    category: 'Model Scaling',
    content: 'Empirical scaling laws show that language model performance predictably improves as a power-law with model size, dataset size, and the amount of compute used for training.',
    source: 'Kaplan et al., 2020 (OpenAI)',
    url: 'https://arxiv.org/abs/2001.08361'
  },
  {
    id: 'kb-003',
    title: 'Retrieval-Augmented Generation (RAG)',
    category: 'Technique',
    content: 'RAG mitigates hallucinations and integrates up-to-date information by combining a dense retriever (which fetches relevant documents from a corpus) with a sequence-to-sequence generator.',
    source: 'Lewis et al., 2020 (NeurIPS)',
    url: 'https://arxiv.org/abs/2005.11401'
  },
  {
    id: 'kb-004',
    title: 'Chain-of-Thought Prompting Elicits Reasoning',
    category: 'Prompt Engineering',
    content: 'Providing few-shot examples of intermediate reasoning steps (Chain-of-Thought) significantly improves the ability of large language models to perform complex logical and mathematical reasoning tasks.',
    source: 'Wei et al., 2022 (Google Research)',
    url: 'https://arxiv.org/abs/2201.11903'
  },
  {
    id: 'kb-005',
    title: 'Direct Preference Optimization (DPO)',
    category: 'Alignment',
    content: 'DPO simplifies the RLHF (Reinforcement Learning from Human Feedback) pipeline by mathematically framing the preference modeling directly as a classification problem on the language model policy, bypassing the need for a separate reward model.',
    source: 'Rafailov et al., 2023 (Stanford)',
    url: 'https://arxiv.org/abs/2305.18290'
  },
  {
    id: 'kb-006',
    title: 'Constitutional AI',
    category: 'Safety & Alignment',
    content: 'Constitutional AI aligns models using a predefined set of rules or principles (a constitution). The model critiques its own responses and revises them to comply with the rules, requiring less direct human feedback than RLHF.',
    source: 'Bai et al., 2022 (Anthropic)',
    url: 'https://arxiv.org/abs/2212.08073'
  },
  {
    id: 'kb-007',
    title: 'Mixture of Experts (MoE)',
    category: 'Architecture',
    content: 'MoE scales model capacity by introducing sparse expert layers. For each token, a gating network routes the computation to only a subset of the available experts, allowing for vastly more parameters with roughly constant inference cost.',
    source: 'Shazeer et al., 2017 / Fedus et al., 2021 (Switch Transformers)',
    url: 'https://arxiv.org/abs/2101.03961'
  }
];
