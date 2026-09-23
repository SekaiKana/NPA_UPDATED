'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  getLang,
  getServerLang,
  setLang as writeLang,
  subscribeLang,
  type Lang,
} from '@/lib/lang/store';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

/**
 * Site copy, in both languages.
 *
 * The substantive material — capability descriptions, the commitment
 * statements, team biographies — is carried over unchanged from the previous
 * site along with its Japanese, because it is accurate and well translated.
 * What changed is the scaffolding around it: section framing, navigation and
 * connective copy were rewritten for the new structure.
 */
const translations: Record<string, Record<Lang, string>> = {
  // ---- Navigation -------------------------------------------------------
  'nav.work': { EN: 'Work', JP: '実績' },
  'nav.capabilities': { EN: 'Capabilities', JP: '開発領域' },
  'nav.studio': { EN: 'Studio', JP: 'スタジオ' },
  'nav.contact': { EN: 'Contact', JP: 'お問い合わせ' },
  'nav.cta': { EN: 'Start a project', JP: 'プロジェクトを始める' },
  'nav.menu': { EN: 'Menu', JP: 'メニュー' },
  'nav.close': { EN: 'Close', JP: '閉じる' },

  // ---- Home: hero -------------------------------------------------------
  'home.hero.l1': { EN: 'We build', JP: '貴社のビジネスを、' },
  'home.hero.l2': { EN: 'your business', JP: 'ソフトウェアへと' },
  'home.hero.l3': { EN: 'into software.', JP: '具現化する。' },
  'home.hero.sub': {
    EN: 'Tell us the bottleneck. We architect and ship the exact system that breaks it, at a pace traditional agencies cannot match.',
    JP: 'ボトルネックをお聞かせください。それを打破する最適なシステムを設計し、従来の開発会社では到達できないスピードで実装します。',
  },

  // ---- Home: statement --------------------------------------------------
  'home.statement.label': { EN: 'Position', JP: 'ポジション' },
  'home.statement.body': {
    EN: 'Most software is slow to build because the process is slow, not because the problem is hard. We rebuilt the process.',
    JP: 'ソフトウェア開発が遅いのは、課題が難しいからではなく、プロセスが遅いからです。私たちはそのプロセスそのものを作り直しました。',
  },

  // ---- Home: capabilities index ----------------------------------------
  'home.cap.label': { EN: 'Capabilities', JP: '開発領域' },
  'home.cap.title': { EN: 'No fixed service tiers.', JP: '定型プランは、ありません。' },
  'home.cap.link': { EN: 'All capabilities', JP: 'すべての開発領域' },

  // ---- Home: work -------------------------------------------------------
  'home.work.label': { EN: 'Selected work', JP: '実績' },
  'home.work.title': { EN: 'Shipped, not slideware.', JP: '資料ではなく、稼働するプロダクトを。' },
  'home.work.link': { EN: 'View all work', JP: 'すべての実績を見る' },

  // ---- Home: approach ---------------------------------------------------
  'home.approach.label': { EN: 'The edge', JP: '私たちの強み' },
  'home.approach.title': { EN: 'Ship faster. Build smarter.', JP: 'より速く、より賢く。' },
  'home.approach.body': {
    EN: 'We do not just write code; we architect solutions. Our proprietary engineering workflows let us iterate rapidly and deliver production-ready software in a fraction of the traditional timeline. Clean, tested, deployable, and yours.',
    JP: '私たちは単にコードを書く集団ではなく、解決策そのものを設計するアーキテクトです。独自のエンジニアリング・ワークフローにより高速なイテレーションを実現し、従来の数分の一という短期間で、クリーンで検証済みの即デプロイ可能なソフトウェアを提供します。そのすべてが、貴社の資産となります。',
  },
  'home.spec1.value': { EN: '14', JP: '14' },
  'home.spec1.unit': { EN: 'days', JP: '日間' },
  'home.spec1.label': { EN: 'MVP sprint', JP: 'MVPスプリント' },
  'home.spec2.value': { EN: '100', JP: '100' },
  'home.spec2.unit': { EN: 'percent', JP: '％' },
  'home.spec2.label': { EN: 'Code ownership', JP: 'コード所有権' },
  'home.spec3.value': { EN: '0', JP: '0' },
  'home.spec3.unit': { EN: 'count', JP: '件' },
  'home.spec3.label': { EN: 'Technical limits', JP: '技術的制限' },

  // ---- Home / global CTA ------------------------------------------------
  'cta.label': { EN: 'Start here', JP: 'お問い合わせ' },
  'cta.title': { EN: 'Tell us the bottleneck.', JP: '課題を、お聞かせください。' },
  'cta.body': {
    EN: 'A short description of the problem is enough to start. We reply within one business day.',
    JP: '課題の概要だけで十分です。1営業日以内にご返信します。',
  },
  'cta.button': { EN: 'Start a project', JP: 'プロジェクトを始める' },

  // ---- Work -------------------------------------------------------------
  'work.label': { EN: 'Work', JP: '実績' },
  'work.title': { EN: 'Proof of impact.', JP: '成果という、証明。' },
  'work.desc': {
    EN: 'Selected engagements. Every system below was designed, built and deployed by the team that still maintains it.',
    JP: '主要なプロジェクトの一部です。以下のすべてのシステムは、現在も運用を担当するチーム自身が設計・構築・実装しました。',
  },
  'work.placeholder.note': {
    EN: 'Case study in preparation',
    JP: '事例を準備中',
  },
  'work.index': { EN: 'Index', JP: '一覧' },
  'work.sector': { EN: 'Sector', JP: '業種' },
  'work.year': { EN: 'Year', JP: '年' },
  'work.scope': { EN: 'Scope', JP: '担当範囲' },

  // ---- Capabilities -----------------------------------------------------
  'cap.label': { EN: 'Capabilities', JP: '開発領域' },
  'cap.title': { EN: 'Capabilities & scope.', JP: '開発領域とサービス内容' },
  'cap.desc': {
    EN: "We don't restrict ourselves to specific stacks or standard service tiers. If your business has a bottleneck, we architect the exact software solution to break it.",
    JP: '特定の技術スタックや定型的なプランという枠組みに私たちは縛られません。貴社のビジネスの成長を阻むボトルネックを「最適」を超えた「究極」のソフトウェア・ソリューションで打破します。',
  },
  'cap.1.title': { EN: 'Digital Products & SaaS', JP: 'デジタルプロダクト ＆ SaaS開発' },
  'cap.1.desc': {
    EN: 'End-to-end development for complex web platforms, client portals, and multi-tenant SaaS products. Built for scale, security, and flawless user experience.',
    JP: '複雑なWebプラットフォーム、顧客ポータル、マルチテナント型SaaSのエンドツーエンド開発。拡張性、堅牢なセキュリティ、そして洗練されたユーザー体験を最高次元で両立します。',
  },
  'cap.2.title': { EN: 'Intelligent Systems & RAG', JP: 'インテリジェント・システム ＆ RAG' },
  'cap.2.desc': {
    EN: 'We embed cutting-edge AI directly into your operations. From custom RAG chatbots to intelligent workflow automation and natural language data querying.',
    JP: '最先端のAIを貴社のオペレーションの中核へ。独自のRAGチャットボット、インテリジェントな自動化ワークフロー、そして自然言語による直感的なデータ検索システムまで。AIを「道具」から「実戦力」へと進化させます。',
  },
  'cap.3.title': { EN: 'Internal Tooling & GUIs', JP: '社内ツール ＆ カスタムGUI' },
  'cap.3.desc': {
    EN: 'Stop running your business on spreadsheets. We build bespoke administrative dashboards, client management systems, and tailored operational interfaces.',
    JP: 'スプレッドシート中心の業務から真の効率化へ。汎用ツールへの依存から脱却し、貴社のワークフローに完全最適化された管理ダッシュボード、顧客管理システム、直感的なオペレーション・インターフェースをオーダーメイドで構築します。',
  },
  'cap.4.title': { EN: 'Data Pipelines & Retrieval', JP: 'データパイプライン ＆ データ抽出' },
  'cap.4.desc': {
    EN: 'Robust backend engineering to gather the data you need. We design custom scraping scripts, integrate disparate APIs, and build the infrastructure to securely route your data.',
    JP: '必要なデータを確実に収集するための堅牢なバックエンド・エンジニアリング。カスタム・スクレイピング・スクリプトの設計、分散したAPIの統合、そしてデータを安全かつ効率的に集約・配信するためのインフラを構築します。',
  },
  'cap.5.title': { EN: 'Advanced Analytics & BI', JP: '高度な分析 ＆ BI' },
  'cap.5.desc': {
    EN: 'Translating raw data into strategic leverage. We engineer quantitative models, statistical reporting tools, and interactive dashboards to give you total operational visibility.',
    JP: '生のデータを、戦略的な競争優位性へと昇華させる。定量モデルの構築、統計的レポーティングツール、そして直感的なインタラクティブ・ダッシュボードの設計。事業運営のあらゆる側面を可視化し、データに基づいた意思決定（データドリブン）を加速させます。',
  },
  /* TODO(copy): mine to propose, yours to approve, both languages. Written to
     the same shape as the other six: a title in the "X & Y" form, then two
     sentences that say what is built and what it is built for. */
  'cap.7.title': { EN: 'Interactive Sites & Experiences', JP: 'インタラクティブサイト ＆ 体験設計' },
  'cap.7.desc': {
    EN: 'State of the art websites built as experiences rather than templates. Real time 3D, physics and motion, engineered to stay fast on every device and to read as a product rather than a brochure.',
    JP: 'テンプレートではなく「体験」として構築する、最先端のウェブサイト。リアルタイム3D、物理演算、モーションを駆使しながら、あらゆるデバイスで軽快に動作し、パンフレットではなく「プロダクト」としての完成度を実現します。',
  },

  'cap.6.title': { EN: 'Rapid MVP Prototyping', JP: '高速MVPプロトタイピング' },
  'cap.6.desc': {
    EN: 'Have a new business initiative? Our highly accelerated engineering workflows allow us to take your concept to a production-ready MVP in a fraction of the traditional timeline.',
    JP: '新規事業の立ち上げを最速で具現化。当社独自の超高速エンジニアリング・ワークフローにより、構想段階のコンセプトから実運用（プロダクション）レベルのMVPを、従来の数分の一という圧倒的な短期間で構築・リリースします。',
  },

  // ---- Studio -----------------------------------------------------------
  'studio.label': { EN: 'Studio', JP: 'スタジオ' },
  'studio.title': { EN: 'Built different.', JP: '次元の違うエンジニアリング。' },
  'studio.desc': {
    EN: "We're a tight-knit team of engineers who believe great software doesn't need to take forever. Our proprietary methodologies let us deliver production-grade products at a pace that traditional agencies can't match, without cutting corners.",
    JP: '私たちは、優れたソフトウェアの開発に膨大な時間は必要ないと確信しているエンジニアチームです。品質への一切の妥協を排しながら、従来の開発会社には到底到達できない圧倒的なスピードで実運用（プロダクション）レベルのプロダクトを完遂します。',
  },

  'studio.principles.label': { EN: 'Principles', JP: '原則' },
  'studio.p1.title': { EN: 'Our Philosophy', JP: '私たちの哲学' },
  'studio.p1.desc': {
    EN: 'Speed without sacrifice. Every line of code is reviewed, tested, and shipped with intent. We move fast because our systems are better, not because we skip steps.',
    JP: '品質を犠牲にしないスピード。すべてのコードは厳格なレビューとテストを経て、確固たる意図を持って実装されます。私たちが速いのは工程を省いているからではありません。システムの設計そのものが他より優れているからです。',
  },
  'studio.p2.title': { EN: 'The Team', JP: 'チーム陣容' },
  'studio.p2.desc': {
    EN: 'Talented engineers only. Our team is made up of driven builders who take ownership, write clean code, and ship reliably across every stage of development.',
    JP: 'トップティアのエンジニアのみ。私たちのチームは、強いオーナーシップを持ち、クリーンなコードを書き、開発の全工程において確実にプロダクトを完遂させる「プロダクト志向」のエンジニアで構成されています。',
  },
  'studio.p3.title': { EN: 'Our Process', JP: '開発プロセス' },
  'studio.p3.desc': {
    EN: 'Rapid discovery. Weekly deploys. Constant communication. We operate like your in-house team, not an outsourced vendor.',
    JP: '迅速な要件定義（ディスカバリー）。週次デプロイ。そして、緊密なコミュニケーション。私たちは単なる「外注先」ではありません。貴社のインハウスチームの一部として、共にプロダクトを創り上げます。',
  },

  'studio.commitment.label': { EN: 'Commitment', JP: '誓約' },
  'studio.commitment.title': { EN: 'Our Commitment to Elite Engineering', JP: '卓越したエンジニアリングへの誓約' },
  'studio.c1.label': { EN: 'The Mission', JP: 'ミッション' },
  'studio.c1.body': {
    EN: 'Neural Point Analytica (NPA) is a software engineering firm dedicated to solving complex operational bottlenecks through custom, high-performance technology. We partner with modern organizations to architect, build, and deploy the exact digital infrastructure they need to scale.',
    JP: 'Neural Point Analytica (NPA) は、高精度なカスタムテクノロジーによって複雑な業務上のボトルネックを打破する、ソフトウェア・エンジニアリング・ファームです。私たちは次世代の企業と共に歩むパートナーとして、事業拡大（スケール）に不可欠なデジタルインフラを構想し、最高水準の設計・構築・実装を一気通貫で提供します。',
  },
  'studio.c2.label': { EN: 'Our Philosophy', JP: '独自のアプローチ' },
  'studio.c2.body': {
    EN: 'Our approach is grounded in absolute engineering flexibility and a problem-first philosophy. We do not restrict our clients to rigid service tiers or pre-packaged platforms. Whether an organization requires a full-stack client management portal, a bespoke internal GUI, an intelligent RAG chatbot system, or robust data retrieval scripts, we engineer the precise system dictated by the business need.',
    JP: '私たちのアプローチの根底にあるのは、圧倒的な技術的柔軟性と「課題解決」を起点とする哲学です。既存のサービス枠やプラットフォームの制約で、クライアントを縛ることはありません。フルスタックの顧客管理ポータル、高度なRAGチャットボット、あるいは堅牢なデータ抽出スクリプトまで。私たちはビジネスの真の要請を見極め、それを解決するために必要なシステムを正確に構築します。',
  },
  'studio.c3.label': { EN: 'The Methodology', JP: '開発メソッド' },
  'studio.c3.body': {
    EN: "NPA's methodology is built on radically accelerated development cycles. Backed by deep expertise in intelligent systems and data architecture, we utilize proprietary, high-speed engineering methodologies to bypass the bloated timelines of traditional development agencies. We focus relentlessly on rapid iteration, delivering clean, tested, and production-ready code in a fraction of the standard timeframe.",
    JP: 'NPAの開発メソッドは、極限まで短縮された開発サイクルに基づいています。インテリジェント・システムとデータアーキテクチャへの深い造詣を背景に、独自の高速エンジニアリング手法を駆使し、従来の開発会社に見られる「肥大化したスケジュール」を根底から排除。クリーンで検証済みの、即戦力となる実運用コードを従来の数分の一という圧倒的な短期間で完遂します。',
  },
  'studio.c4.label': { EN: 'The Outcome', JP: 'もたらす成果' },
  'studio.c4.body': {
    EN: 'By prioritizing architectural rigor, unprecedented speed, and uncompromising quality, NPA empowers businesses to transform their unique operational challenges into proprietary software advantages.',
    JP: '厳格なアーキテクチャ、かつてないスピード、そして妥協なき品質。NPAはこの3つを極限まで追求することで、企業固有の業務課題を「独自のソフトウェア」という強力な武器へ、そして揺るぎない競争優位性へと昇華させます。',
  },

  'studio.team.label': { EN: 'Team', JP: 'チーム' },
  'studio.team.title': { EN: 'Meet the Team', JP: '経営陣・リードエンジニア' },
  'studio.m1.title': { EN: 'Co-CEO / Lead Engineer', JP: '共同代表 / リードエンジニア' },
  /* TODO(copy): the EN is yours, verbatim. The JP is my translation of it and
     needs your eye before it ships — it now names real employers, and a
     mistranslated affiliation is a different class of mistake from an awkward
     sentence. */
  'studio.m1.bio': {
    EN: 'Lead Engineer, specializing in AI/ML architectures and rapid MVP deployment. With a background in quantitative financial modeling and experience as an AI startup founder, Sekai bridges research and production, building systems for both speed and scale. He splits his time between the studio and Applied Research Engineering at Sakana AI, with prior experience applying AI to finance at Neuberger Berman.',
    JP: 'AI・機械学習アーキテクチャ、および高速MVP開発を専門とするリードエンジニア。計量ファイナンスにおけるモデリングや、AIスタートアップ創業者としての経験をバックグラウンドに持ち、先端研究と実運用を架橋し、スピードとスケーラビリティを両立するシステムを構築します。現在はNPAと並行して、Sakana AIにてApplied Research Engineeringに従事。前職のNeuberger Bermanでは、金融領域へのAI適用に取り組みました。',
  },
  'studio.m2.title': { EN: 'Technical Lead', JP: 'テクニカルリード' },
  /* TODO(copy): as above, the EN is yours and the JP is mine to be checked. */
  'studio.m2.bio': {
    EN: 'Lead Application Engineer, specializing in full stack development and intuitive user interfaces. With a strong mathematical background from the University of Waterloo and extensive experience building software in competitive fast paced environments, Ryo creates high performance applications and translates complex backend logic into seamless, production ready user experiences. He also has experience as an AI Engineer at AISTGroup, working with machine learning and computer vision.',
    JP: 'フルスタック開発と直感的なUI構築を専門とするリード・アプリケーション・エンジニア。ウォータールー大学で培った高度な数学的素養と、スピード感が求められる競争の激しい環境での豊富な開発経験を融合。複雑なバックエンド・ロジックを、洗練されたシームレスなユーザー体験（UX）へと昇華させ、実戦的な高パフォーマンス・アプリケーションを構築します。また、AISTGroupではAIエンジニアとして、機械学習およびコンピュータビジョンの開発に従事しました。',
  },
  'studio.m3.title': { EN: 'Co-CEO / Product Strategist', JP: '共同代表 / プロダクトストラテジスト' },
  'studio.m3.bio': {
    EN: 'Product Strategist bridging engineering and business outcomes. Grounded in strategic consulting frameworks and data analytics, Kosei ensures every NPA build drives client KPIs. He specializes in stakeholder alignment, operational strategy, and turning complex bottlenecks into clear, actionable roadmaps.',
    JP: 'エンジニアリングをビジネスの「成果」へと直結させるプロダクト・ストラテジスト。戦略コンサルティングのフレームワークとデータ解析を武器に、NPAによるすべての開発がクライアントのKPI達成に寄与することを徹底します。ステークホルダー間の合意形成からオペレーション戦略の立案、そして複雑なボトルネックを「実行可能なロードマップ」へと具現化することに長けたスペシャリストです。',
  },
  'studio.m4.title': { EN: 'Chief Client Officer', JP: '最高顧客責任者 (CCO)' },
  'studio.m4.bio': {
    EN: 'Chief Client Officer focused on translating complex business needs into precise engineering requirements. Rentaro acts as the bridge between clients and the development team, ensuring every build aligns with the client’s vision and delivers software that is both functional and transformative.',
    JP: '複雑なビジネスニーズを精緻なエンジニアリング要件へと「翻訳」する最高顧客責任者（CCO）。クライアントと開発チームの強固な架け橋となり、すべてのプロジェクトがビジョンを体現し、ビジネスに真の変革をもたらす「プロダクト」へと昇華されることを牽引します。機能性と革新性を最高次元で両立させる、クライアントの最良のパートナーです。',
  },

  // ---- Contact ----------------------------------------------------------
  'contact.label': { EN: 'Contact', JP: 'お問い合わせ' },
  'contact.title': { EN: "Let's build something.", JP: '共に、創りましょう。' },
  'contact.desc': {
    EN: 'Tell us about your project and we will come back within one business day with a plan: scope, timeline, and where we would start.',
    JP: 'プロジェクトの概要をお聞かせください。1営業日以内に、スコープ・スケジュール・着手点をまとめたプランをご返信します。',
  },
  'contact.direct': { EN: 'Or email us directly', JP: 'または直接メールでご連絡ください' },
  'contact.located': { EN: 'Tokyo, Japan', JP: '東京, 日本' },
  'contact.f.name': { EN: 'Name', JP: 'お名前' },
  'contact.f.email': { EN: 'Email', JP: 'メールアドレス' },
  'contact.f.company': { EN: 'Company', JP: '会社名' },
  'contact.f.message': { EN: 'What are you trying to build?', JP: '構築したいものについて' },
  'contact.f.submit': { EN: 'Send enquiry', JP: '送信する' },
  'contact.f.sending': { EN: 'Sending', JP: '送信中' },
  'contact.f.sent': { EN: 'Received. We will be in touch within one business day.', JP: '受け付けました。1営業日以内にご連絡します。' },
  'contact.f.error': { EN: 'Something went wrong. Please email us directly.', JP: '送信に失敗しました。お手数ですが直接メールでご連絡ください。' },
  'contact.f.required': { EN: 'Required', JP: '必須' },

  // ---- Work: held back ---------------------------------------------------
  'work.soon.label': { EN: 'In preparation', JP: '準備中' },
  'work.soon.title': { EN: 'Case studies, shortly.', JP: '実績は、まもなく公開します。' },
  'work.soon.desc': {
    EN: 'We are writing up recent engagements properly rather than publishing placeholders. If you would like to hear what we have built and for whom, ask us directly and we will talk you through it.',
    JP: '体裁だけの実績を並べるのではなく、直近のプロジェクトを丁寧にまとめている最中です。これまでの開発事例について詳しくお知りになりたい場合は、直接お問い合わせください。ご説明いたします。',
  },
  'work.soon.cta': { EN: 'Ask us about our work', JP: '実績について問い合わせる' },

  // ---- Not found / error ------------------------------------------------
  'nf.label': { EN: 'Error 404', JP: 'エラー 404' },
  'nf.title': { EN: 'No page at this address.', JP: 'このアドレスにページはありません。' },
  'nf.desc': {
    EN: 'The link may be out of date, or the page may have moved during the rebuild. The index below covers everything on the site.',
    JP: 'リンクが古いか、リニューアルの際にページが移動した可能性があります。サイトの全ページは以下のインデックスからご覧いただけます。',
  },
  'nf.home': { EN: 'Back to the homepage', JP: 'ホームへ戻る' },
  'err.label': { EN: 'Error 500', JP: 'エラー 500' },
  'err.title': { EN: 'Something broke on our side.', JP: '当社側で問題が発生しました。' },
  'err.desc': {
    EN: 'This is our fault, not yours. Try again, and if it keeps happening, email us and we will look into it.',
    JP: '原因は当社側にあります。再読み込みをお試しください。繰り返し発生する場合はメールでお知らせいただければ調査いたします。',
  },
  'err.retry': { EN: 'Try again', JP: '再試行する' },

  // ---- Per-route document titles ----------------------------------------
  // The <title> the Metadata API renders is English, because the server has no
  // preference to read. These carry the JP half and keep each route distinct
  // once the toggle is used.
  'meta.home.title': {
    EN: 'Custom B2B Software & AI Development Tokyo | Neural Point Analytica (NPA)',
    JP: 'カスタムB2Bソフトウェア＆AI開発（東京）｜Neural Point Analytica (NPA)',
  },
  'meta.home.desc': {
    EN: 'Rapid, elite software engineering for modern companies. Based in Tokyo, Neural Point Analytica builds custom B2B platforms, AI integrations, and high-performance internal tools.',
    JP: '現代の企業に向けた最高峰のソフトウェアエンジニアリング。東京を拠点とする Neural Point Analytica は、カスタムプラットフォーム、AI統合、高性能な社内ツールを圧倒的なスピードで構築します。',
  },
  'meta.work.title': {
    EN: 'Work — in preparation | Neural Point Analytica',
    JP: '実績（準備中）｜Neural Point Analytica',
  },
  'meta.work.desc': {
    EN: 'Case studies from Neural Point Analytica are being written up. Ask us directly about what we have built.',
    JP: 'Neural Point Analytica の実績は現在準備中です。これまでの開発事例については直接お問い合わせください。',
  },
  'meta.capabilities.title': {
    EN: 'Capabilities | Neural Point Analytica',
    JP: '開発領域｜Neural Point Analytica',
  },
  'meta.capabilities.desc': {
    EN: 'What we build: custom B2B platforms, AI and RAG integrations, internal tooling, data infrastructure and production-ready MVPs.',
    JP: '提供領域：カスタムB2Bプラットフォーム、AI・RAG統合、社内ツール、データ基盤、本番運用可能なMVP開発。',
  },
  'meta.studio.title': {
    EN: 'Studio | Neural Point Analytica',
    JP: 'スタジオ｜Neural Point Analytica',
  },
  'meta.studio.desc': {
    EN: 'The team, the principles and the commitments behind Neural Point Analytica, a software engineering studio in Tokyo.',
    JP: '東京のソフトウェア・エンジニアリング・スタジオ Neural Point Analytica のチーム、理念、そしてお客様へのお約束。',
  },
  'meta.contact.title': {
    EN: 'Contact | Neural Point Analytica',
    JP: 'お問い合わせ｜Neural Point Analytica',
  },
  'meta.contact.desc': {
    EN: 'Tell us about your project. We reply within one business day with scope, timeline and where we would start.',
    JP: 'プロジェクトについてお聞かせください。スコープ・スケジュール・着手点をまとめ、1営業日以内にご返信します。',
  },

  // ---- Footer -----------------------------------------------------------
  'footer.cta': { EN: 'Start a project', JP: 'プロジェクトを始める' },
  'footer.nav': { EN: 'Index', JP: 'インデックス' },
  'footer.contact': { EN: 'Contact', JP: 'お問い合わせ' },
  'footer.located': { EN: 'Tokyo, Japan', JP: '東京, 日本' },
  'footer.copy': {
    EN: '© 2026 Neural Point Analytica. All rights reserved.',
    JP: '© 2026 Neural Point Analytica. All rights reserved.',
  },
};

/** Pathname to metadata key. Anything unlisted falls back to the homepage. */
const META_ROUTES: Record<string, string> = {
  '/': 'home',
  '/work': 'work',
  '/capabilities': 'capabilities',
  '/studio': 'studio',
  '/contact': 'contact',
};

const LangContext = createContext<LangContextValue | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribeLang, getLang, getServerLang);
  const pathname = usePathname();

  const t = (key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] ?? entry.EN ?? key;
  };

  /* Keep the document language and SEO metadata in sync with the toggle.

     The Metadata API already renders the correct English <title> per route on
     the server, which is what crawlers read. This only covers the client-side
     half: swapping to Japanese, and keeping the title right across a
     client-side navigation. It is keyed on the route so it stops stamping the
     homepage title onto every page.

     Writing to `document.title` once is not enough. React commits the <title>
     element from the route's metadata during hydration, which lands *after*
     this effect and puts the English title back. Rather than race it, the
     observer below re-asserts the translated title whenever something else
     rewrites the head, and the equality guard keeps that from looping. */
  useEffect(() => {
    const route = META_ROUTES[pathname] ?? 'home';
    const title = t(`meta.${route}.title`);
    const description = t(`meta.${route}.desc`);

    document.documentElement.lang = lang === 'JP' ? 'ja' : 'en';

    const apply = () => {
      if (document.title !== title) document.title = title;
      const meta = document.querySelector('meta[name="description"]');
      if (meta && meta.getAttribute('content') !== description) {
        meta.setAttribute('content', description);
      }
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
    // `t` is derived from `lang`, so `lang` is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, pathname]);

  return (
    <LangContext.Provider value={{ lang, setLang: writeLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');
  return ctx;
}
