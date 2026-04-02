'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Lang = 'EN' | 'JP';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Lang, string>> = {
  // Navigation
  'nav.home': { EN: 'Home', JP: 'ホーム' },
  'nav.services': { EN: 'Services', JP: '事業内容' },
  'nav.about': { EN: 'About Us', JP: '会社概要' },
  'nav.caseStudies': { EN: 'Case Studies', JP: '導入事例' },
  'nav.contact': { EN: 'Contact', JP: 'お問い合わせ' },
  'nav.cta': { EN: 'Get in touch', JP: 'ご相談はこちら' },

  // Homepage - Hero
  'home.hero.title1': { EN: 'We build your business ', JP: '貴社のビジネスを、' },
  'home.hero.title2': { EN: 'into software.', JP: 'ソフトウェアで進化させる。' },
  'home.hero.sub': {
    EN: "Rapid, elite software engineering for modern companies. From custom GUIs to AI integrations and backend automation, tell us your business problem, and we'll build the exact digital product to solve it at unprecedented speed.",
    JP: '次世代のビジネスに最高峰のエンジニアリングを。カスタムGUIからAI統合、バックエンドの自動化まで、あらゆる課題に即応します。貴社のビジネスの課題を常識を打ち破る圧倒的なスピードで解決に直結するデジタルプロダクトへと具現化します。',
  },
  'home.hero.cta': { EN: 'Start a Project ', JP: 'プロジェクトを始める ' },

  // Homepage - Services
  'home.services.label': { EN: 'What We Build', JP: '開発領域' },
  'home.services.title': { EN: 'Limitless Engineering Scope.', JP: '制限のないエンジニアリング領域' },
  'home.services.card1.title': { EN: 'Client-Facing Experiences', JP: '顧客向けサービス' },
  'home.services.card1.body': {
    EN: 'If your users touch it, we can build it. From high-converting landing pages to complex, full-stack web platforms and mobile applications, we engineer digital products that look premium and perform flawlessly.',
    JP: '顧客が触れるものすべてを最高の体験に。高転換なランディングページから、複雑なフルスタックWebプラットフォーム、モバイルアプリまで。洗練されたデザインと妥協のないパフォーマンスを両立し、プロダクトの価値を最大化します。',
  },
  'home.services.card2.title': { EN: 'Internal Optimization', JP: '社内業務の最適化' },
  'home.services.card2.body': {
    EN: 'We eliminate operational bottlenecks. Whether you need an intelligent RAG chatbot to handle queries, custom GUIs for client management, or scripts to automate tedious workflows, we build the tools that make your team faster.',
    JP: '業務のボトルネックを徹底的に排除します。高度なRAGチャットボットによる自動応答、直感的な顧客管理GUI、そして煩雑なワークフローを解消する自動化スクリプト。チームのポテンシャルを解放し、生産性を飛躍的に向上させる最適な内部ツールを構築します。',
  },
  'home.services.card3.title': { EN: 'Bespoke Problem Solving', JP: '完全オーダーメイドの課題解決' },
  'home.services.card3.body': {
    EN: 'Unbound by rigid service tiers. If you have a unique business challenge—complex data retrieval, custom algorithm development, or bridging legacy systems—we design and ship the exact software architecture required to solve it.',
    JP: '既存のサービス枠にとらわれない真のオーダーメイド。複雑なデータ抽出、独自のアルゴリズム開発、レガシーシステムの統合など、貴社特有の難解な課題に対し、解決の要となるソフトウェア・アーキテクチャを設計し、迅速に実装まで完遂します。',
  },

  // Homepage - Vibe
  'home.vibe.label': { EN: 'Our Edge', JP: '私たちの強み' },
  'home.vibe.title': { EN: 'Ship faster. Build smarter.', JP: 'より速く、よりスマートに構築する。' },
  'home.vibe.p1': {
    EN: "We don't just write code; we architect solutions. Whether you need a simple script to automate data retrieval or a complex, full-stack client management portal, we adapt to your exact needs. Our proprietary engineering workflows allow us to iterate rapidly, delivering production-ready software in a fraction of the traditional timeline.",
    JP: '私たちは単にコードを書く集団ではなく、解決策そのものを設計するアーキテクトです。データ抽出を自動化するシンプルなスクリプトから、複雑なフルスタックの顧客管理ポータルまで、貴社のニーズに完璧に適応します。独自のエンジニアリング・ワークフローにより高速なイテレーションを実現。従来の数分の一という短期間で、即戦力となるソフトウェアを実装します。',
  },
  'home.vibe.p2': {
    EN: 'No bloated timelines. No rigid limitations on what we can build. Just clean, tested, deployable software, shipped relentlessly to solve your specific business challenges.',
    JP: '肥大化したスケジュールや、技術的な制約による妥協は一切ありません。貴社特有のビジネス課題を打破するために、クリーンで検証済みの即デプロイ可能なソフトウェアを圧倒的なスピード感で提供し続けます。',
  },
  'home.vibe.stat1': { EN: 'DAY MVP Sprints', JP: '日間 MVPスプリント' },
  'home.vibe.stat2': { EN: 'Code Ownership', JP: 'コード所有権' },
  'home.vibe.stat3': { EN: 'Technical Limits', JP: '技術的制限' },

  // Services Page
  'services.label': { EN: 'Services', JP: '事業内容' },
  'services.title': { EN: 'Capabilities & Scope.', JP: '開発領域とサービス内容' },
  'services.desc': {
    EN: "We don't restrict ourselves to specific stacks or standard service tiers. If your business has a bottleneck, we architect the exact software solution to break it.",
    JP: '特定の技術スタックや定型的なプランという枠組みに私たちは縛られません。貴社のビジネスの成長を阻むボトルネックを「最適」を超えた「究極」のソフトウェア・ソリューションで打破します。',
  },
  'services.card1.title': { EN: 'Digital Products & SaaS', JP: 'デジタルプロダクト ＆ SaaS開発' },
  'services.card1.desc': {
    EN: 'End-to-end development for complex web platforms, client portals, and multi-tenant SaaS products. Built for scale, security, and flawless user experience.',
    JP: '複雑なWebプラットフォーム、顧客ポータル、マルチテナント型SaaSのエンドツーエンド開発。拡張性、堅牢なセキュリティ、そして洗練されたユーザー体験を最高次元で両立します。',
  },
  'services.card2.title': { EN: 'Intelligent Systems & RAG', JP: 'インテリジェント・システム ＆ RAG' },
  'services.card2.desc': {
    EN: 'We embed cutting-edge AI directly into your operations. From custom RAG chatbots to intelligent workflow automation and natural language data querying.',
    JP: '最先端のAIを貴社のオペレーションの中核へ。独自のRAGチャットボット、インテリジェントな自動化ワークフロー、そして自然言語による直感的なデータ検索システムまで。AIを「道具」から「実戦力」へと進化させます。',
  },
  'services.card3.title': { EN: 'Internal Tooling & GUIs', JP: '社内ツール ＆ カスタムGUI' },
  'services.card3.desc': {
    EN: 'Stop running your business on spreadsheets. We build bespoke administrative dashboards, client management systems, and tailored operational interfaces.',
    JP: 'スプレッドシート中心の業務から真の効率化へ。汎用ツールへの依存から脱却し、貴社のワークフローに完全最適化された管理ダッシュボード、顧客管理システム、直感的なオペレーション・インターフェースをオーダーメイドで構築します。',
  },
  'services.card4.title': { EN: 'Data Pipelines & Retrieval', JP: 'データパイプライン ＆ データ抽出' },
  'services.card4.desc': {
    EN: 'Robust backend engineering to gather the data you need. We design custom scraping scripts, integrate disparate APIs, and build the infrastructure to securely route your data.',
    JP: '必要なデータを確実に収集するための堅牢なバックエンド・エンジニアリング。カスタム・スクレイピング・スクリプトの設計、分散したAPIの統合、そしてデータを安全かつ効率的に集約・配信するためのインフラを構築します。',
  },
  'services.card5.title': { EN: 'Advanced Analytics & BI', JP: '高度な分析 ＆ BI' },
  'services.card5.desc': {
    EN: 'Translating raw data into strategic leverage. We engineer quantitative models, statistical reporting tools, and interactive dashboards to give you total operational visibility.',
    JP: '生のデータを、戦略的な競争優位性へと昇華させる。定量モデルの構築、統計的レポーティングツール、そして直感的なインタラクティブ・ダッシュボードの設計。事業運営のあらゆる側面を可視化し、データに基づいた意思決定（データドリブン）を加速させます。',
  },
  'services.card6.title': { EN: 'Rapid MVP Prototyping', JP: '高速MVPプロトタイピング' },
  'services.card6.desc': {
    EN: 'Have a new business initiative? Our highly accelerated engineering workflows allow us to take your concept to a production-ready MVP in a fraction of the traditional timeline.',
    JP: '新規事業の立ち上げを最速で具現化。当社独自の超高速エンジニアリング・ワークフローにより、構想段階のコンセプトから実運用（プロダクション）レベルのMVPを、従来の数分の一という圧倒的な短期間で構築・リリースします。',
  },

  // About Us Page
  'about.label': { EN: 'About Us', JP: '会社概要' },
  'about.title': { EN: 'Built different.', JP: '次元の違うエンジニアリング。' },
  'about.desc': {
    EN: "We're a tight-knit team of engineers who believe great software doesn't need to take forever. Our proprietary methodologies let us deliver production-grade products at a pace that traditional agencies can't match — without cutting corners.",
    JP: '私たちは、優れたソフトウェアの開発に膨大な時間は必要ないと確信しているエンジニアチームです。品質への一切の妥協を排しながら、従来の開発会社には到底到達できない圧倒的なスピードで実運用（プロダクション）レベルのプロダクトを完遂します。',
  },
  'about.card1.title': { EN: 'Our Philosophy', JP: '私たちの哲学' },
  'about.card1.desc': {
    EN: 'Speed without sacrifice. Every line of code is reviewed, tested, and shipped with intent. We move fast because our systems are better, not because we skip steps.',
    JP: '品質を犠牲にしないスピード。すべてのコードは厳格なレビューとテストを経て、確固たる意図を持って実装されます。私たちが速いのは工程を省いているからではありません。システムの設計そのものが他より優れているからです。',
  },
  'about.card2.title': { EN: 'The Team', JP: 'チーム陣容' },
  'about.card2.desc': {
    EN: 'Talented engineers only. Our team is made up of driven builders who take ownership, write clean code, and ship reliably across every stage of development.',
    JP: 'トップティアのエンジニアのみ。私たちのチームは、強いオーナーシップを持ち、クリーンなコードを書き、開発の全工程において確実にプロダクトを完遂させる「プロダクト志向」のエンジニアで構成されています。',
  },
  'about.card3.title': { EN: 'Our Process', JP: '開発プロセス' },
  'about.card3.desc': {
    EN: 'Rapid discovery. Weekly deploys. Constant communication. We operate like your in-house team, not an outsourced vendor.',
    JP: '迅速な要件定義（ディスカバリー）。週次デプロイ。そして、緊密なコミュニケーション。私たちは単なる「外注先」ではありません。貴社のインハウスチームの一部として、共にプロダクトを創り上げます。',
  },

  // About Us - Commitment Tabs
  'about.commitment.title': { EN: 'Our Commitment to Elite Engineering', JP: '卓越したエンジニアリングへの誓約' },
  'about.commitment.tab1.label': { EN: 'The Mission', JP: 'ミッション' },
  'about.commitment.tab1.content': {
    EN: 'Neural Point Analytica (NPA) is a software engineering firm dedicated to solving complex operational bottlenecks through custom, high-performance technology. We partner with modern organizations to architect, build, and deploy the exact digital infrastructure they need to scale.',
    JP: 'Neural Point Analytica (NPA) は、高精度なカスタムテクノロジーによって複雑な業務上のボトルネックを打破する、ソフトウェア・エンジニアリング・ファームです。私たちは次世代の企業と共に歩むパートナーとして、事業拡大（スケール）に不可欠なデジタルインフラを構想し、最高水準の設計・構築・実装を一気通貫で提供します。',
  },
  'about.commitment.tab2.label': { EN: 'Our Philosophy', JP: '独自のアプローチ' },
  'about.commitment.tab2.content': {
    EN: 'Our approach is grounded in absolute engineering flexibility and a problem-first philosophy. We do not restrict our clients to rigid service tiers or pre-packaged platforms. Whether an organization requires a full-stack client management portal, a bespoke internal GUI, an intelligent RAG chatbot system, or robust data retrieval scripts, we engineer the precise system dictated by the business need.',
    JP: '私たちのアプローチの根底にあるのは、圧倒的な技術的柔軟性と「課題解決」を起点とする哲学です。既存のサービス枠やプラットフォームの制約で、クライアントを縛ることはありません。フルスタックの顧客管理ポータル、高度なRAGチャットボット、あるいは堅牢なデータ抽出スクリプトまで。私たちはビジネスの真の要請を見極め、それを解決するために必要なシステムを正確に構築します。',
  },
  'about.commitment.tab3.label': { EN: 'The Methodology', JP: '開発メソッド' },
  'about.commitment.tab3.content': {
    EN: "NPA's methodology is built on radically accelerated development cycles. Backed by deep expertise in intelligent systems and data architecture, we utilize proprietary, high-speed engineering methodologies to bypass the bloated timelines of traditional development agencies. We focus relentlessly on rapid iteration, delivering clean, tested, and production-ready code in a fraction of the standard timeframe.",
    JP: 'NPAの開発メソッドは、極限まで短縮された開発サイクルに基づいています。インテリジェント・システムとデータアーキテクチャへの深い造詣を背景に、独自の高速エンジニアリング手法を駆使し、従来の開発会社に見られる「肥大化したスケジュール」を根底から排除。クリーンで検証済みの、即戦力となる実運用コードを従来の数分の一という圧倒的な短期間で完遂します。',
  },
  'about.commitment.tab4.label': { EN: 'The Outcome', JP: 'もたらす成果' },
  'about.commitment.tab4.content': {
    EN: 'By prioritizing architectural rigor, unprecedented speed, and uncompromising quality, NPA empowers businesses to transform their unique operational challenges into proprietary software advantages.',
    JP: '厳格なアーキテクチャ、かつてないスピード、そして妥協なき品質。NPAはこの3つを極限まで追求することで、企業固有の業務課題を「独自のソフトウェア」という強力な武器へ、そして揺るぎない競争優位性へと昇華させます。',
  },

  // About Us - Team Grid
  'about.team.sectionTitle': { EN: 'Meet the Team', JP: '経営陣・リードエンジニア' },
  'about.team.member1.title': { EN: 'Co-CEO / Lead Engineer', JP: '共同代表 / リードエンジニア' },
  'about.team.member1.bio': {
    EN: 'Lead Engineer specializing in AI and machine learning architectures and rapid MVP deployment. With a background in quantitative financial modeling and experience as a former AI startup founder, Sekai bridges the gap between research and production, building systems designed for both speed and scale.',
    JP: 'AI・機械学習アーキテクチャ、および高速MVP開発を専門とするリードエンジニア。計量ファイナンスにおけるモデリングや、AIスタートアップ創業者としての経験をバックグラウンドに持ち、先端研究と実運用の「最適解」を導き出すスペシャリスト。スピードとスケーラビリティを最高次元で両立するシステムを構築します。',
  },
  'about.team.member2.title': { EN: 'Co-CEO / Lead Application Engineer', JP: '共同代表 / リードアプリケーションエンジニア' },
  'about.team.member2.bio': {
    EN: 'Lead Application Engineer specializing in full stack development and intuitive user interfaces. With a strong mathematical background from the University of Waterloo and extensive experience building software in competitive fast paced environments, Ryo creates high performance applications and translates complex backend logic into seamless, production ready user experiences.',
    JP: 'フルスタック開発と直感的なUI構築を専門とするリード・アプリケーション・エンジニア。ウォータールー大学で培った高度な数学的素養と、スピード感が求められる競争の激しい環境での豊富な開発経験を融合。複雑なバックエンド・ロジックを、洗練されたシームレスなユーザー体験（UX）へと昇華させ、実戦的な高パフォーマンス・アプリケーションを構築します。',
  },
  'about.team.member3.title': { EN: 'Co-CEO / Product Strategist', JP: '共同代表 / プロダクトストラテジスト' },
  'about.team.member3.bio': {
    EN: 'Product Strategist bridging engineering and business outcomes. Grounded in strategic consulting frameworks and data analytics, Kosei ensures every NPA build drives client KPIs. He specializes in stakeholder alignment, operational strategy, and turning complex bottlenecks into clear, actionable roadmaps.',
    JP: 'エンジニアリングをビジネスの「成果」へと直結させるプロダクト・ストラテジスト。戦略コンサルティングのフレームワークとデータ解析を武器に、NPAによるすべての開発がクライアントのKPI達成に寄与することを徹底します。ステークホルダー間の合意形成からオペレーション戦略の立案、そして複雑なボトルネックを「実行可能なロードマップ」へと具現化することに長けたスペシャリストです。',
  },
  'about.team.member4.title': { EN: 'Chief Client Officer', JP: '最高顧客責任者 (CCO)' },
  'about.team.member4.bio': {
    EN: 'Chief Client Officer focused on translating complex business needs into precise engineering requirements. Rentaro acts as the bridge between clients and the development team, ensuring every build aligns with the client’s vision and delivers software that is both functional and transformative.',
    JP: '複雑なビジネスニーズを精緻なエンジニアリング要件へと「翻訳」する最高顧客責任者（CCO）。クライアントと開発チームの強固な架け橋となり、すべてのプロジェクトがビジョンを体現し、ビジネスに真の変革をもたらす「プロダクト」へと昇華されることを牽引します。機能性と革新性を最高次元で両立させる、クライアントの最良のパートナーです。',
  },

  // About Us - CTA
  'about.cta.title': { EN: 'Ready to Build?', JP: 'ビジネスを加速させる「武器」を、今。' },
  'about.cta.btn': { EN: 'Start a Project ', JP: 'プロジェクトを始める ' },

  // Footer
  'footer.tagline': {
    EN: 'Building the future, one deploy at a time.',
    JP: 'Building the future, one deploy at a time.',
  },
  'footer.services': { EN: 'Services', JP: '事業内容' },
  'footer.caseStudies': { EN: 'Case Studies', JP: '導入事例' },
  'footer.contact': { EN: 'Contact', JP: 'お問い合わせ' },
  'footer.copy': {
    EN: '© 2026 Neural Point Analytica. All rights reserved.',
    JP: '© 2026 Neural Point Analytica. All rights reserved.',
  },
};

const LangContext = createContext<LangContextValue | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('EN');

  const t = (key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] ?? entry['EN'] ?? key;
  };

  useEffect(() => {
    if (lang === 'EN') {
      document.title = "Custom B2B Software & AI Development Tokyo | Neural Point Analytica (NPA)";
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', "Rapid, elite software engineering for modern companies. Based in Tokyo, Neural Point Analytica builds custom B2B platforms, AI integrations, and high-performance internal tools.");
      }
    } else {
      document.title = "カスタムB2Bソフトウェア＆AI開発（東京）｜Neural Point Analytica (NPA)";
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', "現代の企業に向けた最高峰のソフトウェアエンジニアリング。東京を拠点とする Neural Point Analytica は、カスタムプラットフォーム、AI統合、高性能な社内ツールを圧倒的なスピードで構築します。");
      }
    }
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');
  return ctx;
}
