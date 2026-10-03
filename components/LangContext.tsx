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
 * Rewritten in September 2026 in the voice of the people who run the studio:
 * a small team of engineers in Tokyo, talking plainly about the work. Two
 * rules hold the whole thing together, and any new line should keep to them.
 *
 * The positioning is flexibility. The studio takes on almost any kind of
 * software problem and works out what it actually needs; that is the
 * headline everywhere. Speed survives only as a supporting fact (a first
 * version in about two weeks, weekly deploys), never as the pitch.
 *
 * The register is a person, not a brochure: short sentences, concrete
 * examples, first person, contractions in English, plain です・ます in
 * Japanese. No superlatives, no "solutions", no claims the site cannot stand
 * behind, and no em or en dashes in either language.
 *
 * Team biographies keep every fact they were given (employers, schools,
 * roles) and only lose the marketing voice. Each person should still read
 * their own before it ships.
 */
const translations: Record<string, Record<Lang, string>> = {
  // ---- Navigation -------------------------------------------------------
  'nav.work': { EN: 'Work', JP: '実績' },
  'nav.capabilities': { EN: 'What we do', JP: '対応領域' },
  'nav.studio': { EN: 'Studio', JP: 'スタジオ' },
  'nav.contact': { EN: 'Contact', JP: 'お問い合わせ' },
  'nav.cta': { EN: 'Start a project', JP: '相談する' },
  'nav.menu': { EN: 'Menu', JP: 'メニュー' },
  'nav.close': { EN: 'Close', JP: '閉じる' },

  // ---- Home: hero -------------------------------------------------------
  'home.hero.l1': { EN: 'Whatever', JP: 'どんな' },
  'home.hero.l2': { EN: "it is, we'll", JP: '課題でも、' },
  'home.hero.l3': { EN: 'work it out.', JP: '形にする。' },
  'home.hero.sub': {
    EN: "A small team of engineers in Tokyo. We take on most kinds of software problem, and the first thing we do is find out what yours actually needs.",
    JP: '東京の小さなエンジニアチームです。分野を問わず、ソフトウェアの課題をお受けしています。まず、本当に必要なものが何かを見極めるところから始めます。',
  },

  // ---- Home: statement --------------------------------------------------
  'home.statement.label': { EN: 'Our view', JP: '考え方' },
  'home.statement.body': {
    EN: "We don't sell one kind of software. Every project starts from what the problem needs, and the tools follow from there.",
    JP: '決まった型のソフトウェアを売ることはしません。どの案件も、課題が何を必要としているかから考え、技術はそのあとで選びます。',
  },

  // ---- Home: capabilities index ----------------------------------------
  'home.cap.label': { EN: 'What we do', JP: '対応領域' },
  'home.cap.title': { EN: 'Some of what we take on.', JP: '手がける仕事の一部です。' },
  'home.cap.link': { EN: 'See the full list', JP: 'すべて見る' },

  // ---- Home: work -------------------------------------------------------
  'home.work.label': { EN: 'Work', JP: '実績' },
  'home.work.title': { EN: "What we've built.", JP: 'これまでに作ったもの。' },
  'home.work.link': { EN: 'See all work', JP: 'すべての実績を見る' },

  // ---- Home: how we work ------------------------------------------------
  'home.approach.label': { EN: 'How we work', JP: '進め方' },
  'home.approach.title': { EN: 'Tools follow the problem.', JP: '技術は、課題に合わせて選ぶ。' },
  'home.approach.body': {
    EN: "We don't have a favourite framework that everything gets squeezed into. We look at how the work is done today, talk to the people who'll use what we build, and pick the tools from there. When we hand it over, the code is yours. All of it.",
    JP: '何でも一つのフレームワークに押し込むようなことはしません。今の業務の進め方を見て、実際に使う方々の話を聞き、それから技術を選びます。納品したコードは、すべて貴社のものです。',
  },
  /* The datasheet, in reading order 3, 2, 1: flexibility first, ownership,
     and the sprint length last as the supporting fact it is. */
  'home.spec1.value': { EN: '2', JP: '2' },
  'home.spec1.unit': { EN: 'weeks', JP: '週間' },
  'home.spec1.label': { EN: 'MVP sprint', JP: 'MVPスプリント' },
  'home.spec2.value': { EN: '100', JP: '100' },
  'home.spec2.unit': { EN: 'percent', JP: '％' },
  'home.spec2.label': { EN: 'Code you own', JP: 'コードの所有権' },
  'home.spec3.value': { EN: '0', JP: '0' },
  'home.spec3.unit': { EN: '', JP: '' },
  'home.spec3.label': { EN: 'Technical limits', JP: '技術的な制約' },

  // ---- Home: the reel ---------------------------------------------------
  /* Every claim in here is one the site already makes: a first version in a
     two week sprint, weekly deploys, full code ownership. The shots
     illustrate them; they do not add to them. */
  'reel.label': { EN: 'Process', JP: 'プロセス' },
  'reel.title': { EN: 'The process, in motion.', JP: '動き出す、開発プロセス。' },
  'reel.hud.shot': { EN: 'Shot', JP: 'ショット' },
  'reel.nav': { EN: 'Reel shots', JP: 'リールのショット' },
  'reel.goto': { EN: 'Go to shot', JP: 'ショットへ移動' },

  'reel.s1.name': { EN: 'Bottleneck', JP: 'ボトルネック' },
  'reel.s1.title': { EN: "Start with what's *stuck.*", JP: 'まず、*滞っている*ところから。' },
  'reel.s1.sub': {
    EN: "Every business has a step where the work piles up. That's usually where we start.",
    JP: 'どんな業務にも、仕事が溜まってしまう工程があります。たいていは、そこから始めます。',
  },
  'reel.s2.name': { EN: 'Architecture', JP: '設計' },
  'reel.s2.title': { EN: 'Work out what it *needs.*', JP: '何が必要かを、*見極める。*' },
  'reel.s2.sub': {
    EN: "Sometimes it's a data pipeline, sometimes a model, sometimes just a better form. We map it out before choosing any tools.",
    JP: 'データの流れかもしれないし、AIかもしれないし、使いやすいフォーム一つかもしれません。技術を選ぶ前に、まず全体を描きます。',
  },
  'reel.s3.name': { EN: 'Build', JP: '構築' },
  'reel.s3.title': { EN: 'Build the *right thing.*', JP: '課題に合うものを、*つくる。*' },
  'reel.s3.sub': {
    EN: 'An internal tool, a platform, a RAG system, a 3D site. Whatever the problem turned out to need.',
    JP: '社内ツールでも、Webプラットフォームでも、RAGでも、3Dサイトでも。課題が必要としていたものを。',
  },
  'reel.s4.name': { EN: 'Ship', JP: 'リリース' },
  'reel.s4.title': { EN: 'Get it in front of *people.*', JP: '早い段階で、*使ってもらう。*' },
  'reel.s4.sub': {
    EN: 'A first working version usually comes out of a two week sprint, and we deploy every week after that.',
    JP: '最初の動くバージョンは、おおむね2週間のスプリントで。その後も毎週デプロイします。',
  },
  'reel.s5.name': { EN: 'Flow', JP: 'フロー' },
  'reel.s5.title': { EN: 'And the work *moves again.*', JP: 'そして、仕事が*また流れ出す。*' },
  'reel.s5.sub': {
    EN: 'That was the point all along. The software is only there to get things moving.',
    JP: '目的は最初からそこです。ソフトウェアは、そのための手段にすぎません。',
  },
  'reel.s6.name': { EN: 'Yours', JP: '所有' },
  'reel.s6.title': { EN: "And it's *yours.*", JP: 'そして、*貴社のもの*です。' },
  'reel.s6.sub': {
    EN: 'You own all of the code.',
    JP: 'コードはすべて貴社に帰属します。',
  },

  /* Annotations drawn inside the reel's canvas. */
  'reel.c.queue': { EN: 'Queue', JP: '待ち行列' },
  'reel.c.throughput': { EN: 'Throughput', JP: 'スループット' },
  'reel.c.bottleneck': { EN: 'Bottleneck', JP: 'ボトルネック' },
  'reel.c.l1': { EN: 'Data', JP: 'データ' },
  'reel.c.l2': { EN: 'Pipelines', JP: 'パイプライン' },
  'reel.c.l3': { EN: 'Services', JP: 'サービス' },
  'reel.c.l4': { EN: 'Intelligence', JP: 'インテリジェンス' },
  'reel.c.l5': { EN: 'Interfaces', JP: 'インターフェース' },
  'reel.c.week': { EN: 'Week', JP: '週' },
  'reel.c.weekOf': { EN: 'Week {n}', JP: '第{n}週' },
  'reel.c.deploy': { EN: 'Deploy', JP: 'デプロイ' },
  'reel.c.mvp': { EN: 'MVP', JP: 'MVP' },

  // ---- Home / global CTA ------------------------------------------------
  'cta.label': { EN: 'Get in touch', JP: 'お問い合わせ' },
  'cta.title': { EN: "Tell us what's in the way.", JP: '困っていることを、聞かせてください。' },
  'cta.body': {
    EN: 'A few lines about the problem is enough to start. We reply within one business day.',
    JP: '課題について数行いただければ十分です。1営業日以内にお返事します。',
  },
  'cta.button': { EN: 'Start a project', JP: '相談する' },

  // ---- Work -------------------------------------------------------------
  'work.label': { EN: 'Work', JP: '実績' },
  'work.title': { EN: "What we've built.", JP: 'これまでに作ったもの。' },
  'work.desc': {
    EN: 'A selection of recent projects, written up properly.',
    JP: '最近の案件から、いくつかをきちんとまとめたものです。',
  },
  'work.placeholder.note': {
    EN: 'Case study in preparation',
    JP: '事例を準備中',
  },
  'work.index': { EN: 'Index', JP: '一覧' },
  'work.sector': { EN: 'Sector', JP: '業種' },
  'work.year': { EN: 'Year', JP: '年' },
  'work.scope': { EN: 'Scope', JP: '担当範囲' },

  // ---- What we do (capabilities) ------------------------------------------
  'cap.label': { EN: 'What we do', JP: '対応領域' },
  'cap.title': { EN: 'What we take on.', JP: '手がけている仕事。' },
  'cap.desc': {
    EN: "We're not specialists in one thing, and that's deliberate. Most projects mix a few of the areas below, and the interesting ones don't fit any of them neatly. If you're not sure which one you need, that's normal. Start with the problem.",
    JP: '一つの分野に絞っていないのは、意図してのことです。多くの案件は下のいくつかにまたがりますし、面白い案件ほどどれにもきれいには当てはまりません。どれが必要か分からなくても大丈夫です。まずは課題から聞かせてください。',
  },
  'cap.1.title': { EN: 'Web platforms & SaaS', JP: 'Webプラットフォーム・SaaS' },
  'cap.1.desc': {
    EN: 'Client portals, multi-tenant SaaS products, account and booking systems. We build the whole thing, from the database to the screens people use.',
    JP: '顧客ポータル、マルチテナントのSaaS、会員・予約システムなど。データベースから実際に使う画面まで、まるごと開発します。',
  },
  'cap.2.title': { EN: 'AI & RAG systems', JP: 'AI・RAGシステム' },
  'cap.2.desc': {
    EN: "Assistants that answer from your own documents, search across internal data, and automation for the repetitive parts of a workflow. We're honest about where AI helps and where it doesn't.",
    JP: '社内資料をもとに答えるアシスタント、社内データの横断検索、定型作業の自動化など。AIが役に立つ場面と、そうでない場面は正直にお伝えします。',
  },
  'cap.3.title': { EN: 'Internal tools', JP: '社内ツール' },
  'cap.3.desc': {
    EN: 'Admin panels, dashboards and client management systems for teams that have outgrown their spreadsheets. Built around how your team already works.',
    JP: 'スプレッドシートでは回らなくなったチームのための管理画面、ダッシュボード、顧客管理システム。今の仕事の進め方に合わせてつくります。',
  },
  'cap.4.title': { EN: 'Data pipelines', JP: 'データパイプライン' },
  'cap.4.desc': {
    EN: 'Scrapers, API integrations and the plumbing that gets data from where it is to where you need it, reliably, and without anyone copying it across by hand.',
    JP: 'スクレイピングやAPI連携など、データを必要な場所まで確実に届ける仕組みづくり。手作業でのコピーをなくします。',
  },
  'cap.5.title': { EN: 'Analytics & reporting', JP: '分析・レポーティング' },
  'cap.5.desc': {
    EN: 'Statistical models, reports and dashboards that turn the data you already collect into something you can make decisions with.',
    JP: '統計モデル、レポート、ダッシュボードなど。すでに集めているデータを、判断に使える形にします。',
  },
  'cap.7.title': { EN: '3D & interactive sites', JP: '3D・インタラクティブサイト' },
  'cap.7.desc': {
    EN: "Websites with real-time 3D, physics and motion that still load quickly on a phone. You're looking at one.",
    JP: 'リアルタイム3D、物理演算、モーションを使いながら、スマートフォンでも軽く動くWebサイト。このサイトもその一つです。',
  },

  'cap.6.title': { EN: 'Prototypes & MVPs', JP: 'プロトタイプ・MVP' },
  'cap.6.desc': {
    EN: 'For a new idea you want to test with real users. We build a working first version, usually within a two week sprint, and keep it simple enough to change.',
    JP: '新しいアイデアを実際のユーザーで試したいときに。最初の動くバージョンを、おおむね2週間のスプリントでつくります。後から変えやすい作りにしておきます。',
  },

  // ---- Studio -----------------------------------------------------------
  'studio.label': { EN: 'Studio', JP: 'スタジオ' },
  'studio.title': { EN: 'A small team in Tokyo.', JP: '東京の、小さなチーム。' },
  'studio.desc': {
    EN: "We're a small team, mostly engineers, based in Tokyo. We take on a wide mix of work because most real problems don't stay inside the lines between web, data and AI, and because we enjoy the variety. You'll deal directly with the people building your project.",
    JP: '東京を拠点にする、エンジニア中心の小さなチームです。幅広い仕事を受けているのは、実際の課題の多くがWeb、データ、AIといった区分に収まらないからで、何よりその幅を楽しんでいるからです。開発を担当する本人と、直接やり取りしていただけます。',
  },

  'studio.principles.label': { EN: 'Principles', JP: '大事にしていること' },
  'studio.p1.title': { EN: 'Problem first', JP: 'まず課題から' },
  'studio.p1.desc': {
    EN: "We don't start from a stack or a template. We start from how the work is done today and what's getting in the way, and choose the tools after that.",
    JP: '技術やテンプレートから考えることはしません。今の業務がどう回っていて、何が妨げになっているのかを見て、それから技術を選びます。',
  },
  'studio.p2.title': { EN: 'A small team', JP: '小さなチーム' },
  'studio.p2.desc': {
    EN: 'There are only a few of us, so the people you meet at the start are the people who build it. Nothing gets lost in a hand-off.',
    JP: '少人数なので、最初に話した相手がそのまま開発します。引き継ぎで話が抜け落ちることがありません。',
  },
  'studio.p3.title': { EN: 'Every week, in the open', JP: '毎週、見える形で' },
  'studio.p3.desc': {
    EN: "We deploy every week and show you what changed, so you're never waiting months to see progress, and changing direction is never a big deal.",
    JP: '毎週デプロイして、何が変わったかをお見せします。進み具合が何か月も見えないということはなく、方向転換も大ごとになりません。',
  },

  'studio.commitment.label': { EN: 'What to expect', JP: 'お約束' },
  'studio.commitment.title': { EN: 'What you can expect from us.', JP: '私たちがお約束すること。' },
  'studio.c1.label': { EN: 'What we are', JP: '私たちについて' },
  'studio.c1.body': {
    EN: 'Neural Point Analytica (NPA) is a small software studio in Tokyo. We build custom software for companies: web platforms, AI and RAG systems, data pipelines, analytics, internal tools and interactive sites.',
    JP: 'Neural Point Analytica（NPA）は、東京の小さなソフトウェアスタジオです。企業向けに、Webプラットフォーム、AI・RAGシステム、データパイプライン、分析、社内ツール、インタラクティブサイトなどをオーダーメイドで開発しています。',
  },
  'studio.c2.label': { EN: 'How we decide', JP: '何をつくるか' },
  'studio.c2.body': {
    EN: "We don't sell packages. Each project starts with a conversation about the problem, and what we build follows from what we learn. Sometimes that's a large platform. Sometimes it's a small script that gives someone an hour of their day back.",
    JP: 'パッケージは売っていません。どの案件も課題についての対話から始まり、そこで分かったことから何をつくるかが決まります。大きなプラットフォームのこともあれば、誰かの一日を一時間楽にする小さなスクリプトのこともあります。',
  },
  'studio.c3.label': { EN: 'How we work', JP: '進め方' },
  'studio.c3.body': {
    EN: 'Short cycles and weekly deploys. You see working software early and often, and you can change your mind along the way. For a new product, the first working version usually takes about two weeks.',
    JP: '短いサイクルで、毎週デプロイします。動くものを早い段階から何度も確認でき、途中で考えが変わっても対応できます。新しいプロダクトなら、最初の動くバージョンはおおむね2週間です。',
  },
  'studio.c4.label': { EN: 'What you keep', JP: '残るもの' },
  'studio.c4.body': {
    EN: "Working software, all of its source code, and a team that knows how it's put together. The code is yours to keep, change or take elsewhere.",
    JP: '動くソフトウェア、そのソースコードのすべて、そして中身を理解しているチーム。コードは貴社のものなので、手元に置くのも、手を入れるのも、ほかに移すのも自由です。',
  },

  /* A proper noun, so it does not translate. */
  'studio.linkedin': { EN: 'LinkedIn', JP: 'LinkedIn' },

  'studio.team.label': { EN: 'Team', JP: 'チーム' },
  'studio.team.title': { EN: 'Who we are.', JP: 'メンバー。' },
  'studio.m1.title': { EN: 'Co-CEO / Lead Engineer', JP: '共同代表 / リードエンジニア' },
  /* TODO(copy): rewritten from the text Sekai supplied, keeping every fact:
     AI/ML and new products, quantitative financial modelling, the AI startup,
     Neuberger Berman, and Applied Research Engineering at Sakana AI. Worth his
     read before it ships, in both languages. */
  'studio.m1.bio': {
    EN: 'Sekai leads engineering. Most of his work is on AI and machine learning systems and on getting new products off the ground. He has a background in quantitative financial modelling, applied AI to finance at Neuberger Berman, and founded an AI startup. He also works in Applied Research Engineering at Sakana AI.',
    JP: 'エンジニアリングを率いています。主にAI・機械学習のシステムと、新しいプロダクトの立ち上げを担当。計量ファイナンスのモデリングに携わり、Neuberger BermanではAIの金融への応用に取り組み、AIスタートアップを創業した経験があります。NPAと並行して、Sakana AIでApplied Research Engineeringにも携わっています。',
  },
  'studio.m2.title': { EN: 'Technical Lead', JP: 'テクニカルリード' },
  /* TODO(copy): as above. Facts kept: application development end to end,
     interfaces, a mathematics background from the University of Waterloo,
     and AI Engineer at AISTGroup on machine learning and computer vision. */
  'studio.m2.bio': {
    EN: 'Ryo leads application development, from the back end to the interface, and cares a lot about software being easy to use. He has a mathematics background from the University of Waterloo and has worked as an AI Engineer at AISTGroup on machine learning and computer vision.',
    JP: 'アプリケーション開発を、バックエンドから画面まで率いています。使いやすさには特にこだわります。ウォータールー大学で数学を学び、AISTGroupではAIエンジニアとして機械学習とコンピュータビジョンに携わりました。',
  },
  'studio.m3.title': { EN: 'Co-CEO / Product Strategist', JP: '共同代表 / プロダクトストラテジスト' },
  'studio.m3.bio': {
    EN: 'Kosei looks after the business side of each project: what it needs to achieve, who needs to agree, and what to build first. He comes from strategy consulting and data analytics.',
    JP: '各プロジェクトのビジネス面を担当します。何を達成すべきか、誰の合意が必要か、何から作るべきかを整理します。戦略コンサルティングとデータ分析の出身です。',
  },
  'studio.m4.title': { EN: 'Chief Client Officer', JP: '最高顧客責任者 (CCO)' },
  'studio.m4.bio': {
    EN: "Rentaro is usually the first person you'll talk to. He turns what you need into something the engineers can build, and stays involved to make sure what gets built is what you asked for.",
    JP: '最初にお話しするのは、たいてい彼です。ご要望をエンジニアが作れる形に落とし込み、最後まで関わって、お願いしたものがきちんと出来上がるよう見届けます。',
  },

  // ---- Contact ----------------------------------------------------------
  'contact.label': { EN: 'Contact', JP: 'お問い合わせ' },
  'contact.title': { EN: 'Start with the problem.', JP: 'まずは、課題から。' },
  'contact.desc': {
    EN: "A few lines about what's going on is enough. It doesn't need to be a spec. We'll reply within one business day, usually with a few questions and a rough idea of where we'd start.",
    JP: '状況を数行書いていただくだけで十分です。仕様書である必要はありません。1営業日以内に、いくつかの質問と、どこから始めるかの大まかな考えをお返しします。',
  },
  'contact.direct': { EN: 'Or just email us', JP: 'メールでも構いません' },
  'contact.located': { EN: 'Tokyo, Japan', JP: '東京, 日本' },
  'contact.f.name': { EN: 'Name', JP: 'お名前' },
  'contact.f.email': { EN: 'Email', JP: 'メールアドレス' },
  'contact.f.company': { EN: 'Company', JP: '会社名' },
  'contact.f.message': { EN: 'What are you trying to solve?', JP: '解決したいこと' },
  'contact.f.submit': { EN: 'Send enquiry', JP: '送信する' },
  'contact.f.sending': { EN: 'Sending', JP: '送信中' },
  'contact.f.sent': { EN: "Got it. We'll get back to you within one business day.", JP: '受け取りました。1営業日以内にご連絡します。' },
  'contact.f.error': { EN: 'Something went wrong on our end. Please email us instead.', JP: '送信できませんでした。お手数ですが、メールでご連絡ください。' },
  'contact.f.required': { EN: 'Required', JP: '必須' },

  // ---- Work: held back ---------------------------------------------------
  'work.soon.label': { EN: 'In preparation', JP: '準備中' },
  'work.soon.title': { EN: 'Case studies are on the way.', JP: '事例は準備中です。' },
  'work.soon.desc': {
    EN: "We're writing up recent projects properly instead of filling this page with placeholders. If you'd like to hear what we've built, ask us and we'll walk you through it.",
    JP: '仮の事例を並べるのではなく、最近の案件をきちんとまとめているところです。これまでに何を作ってきたか知りたい方は、お気軽にお問い合わせください。直接ご説明します。',
  },
  'work.soon.cta': { EN: 'Ask us about our work', JP: '実績について問い合わせる' },

  // ---- Not found / error ------------------------------------------------
  'nf.label': { EN: 'Error 404', JP: 'エラー 404' },
  'nf.title': { EN: 'No page at this address.', JP: 'このアドレスにページはありません。' },
  'nf.desc': {
    EN: "The link may be out of date, or the page moved when we rebuilt the site. Everything that's here is listed below.",
    JP: 'リンクが古いか、サイトを作り直した際にページが移動した可能性があります。現在のページは、下にすべて載せています。',
  },
  'nf.home': { EN: 'Back to the homepage', JP: 'ホームへ戻る' },
  'err.label': { EN: 'Error 500', JP: 'エラー 500' },
  'err.title': { EN: 'Something broke on our side.', JP: 'こちら側で問題が起きました。' },
  'err.desc': {
    EN: "That's on us, not you. Try again, and if it keeps happening, email us and we'll look into it.",
    JP: '原因はこちら側にあります。もう一度お試しいただき、それでも続くようならメールでお知らせください。確認します。',
  },
  'err.retry': { EN: 'Try again', JP: '再試行する' },

  // ---- Per-route document titles ----------------------------------------
  // The <title> the Metadata API renders is English, because the server has no
  // preference to read. These carry the JP half and keep each route distinct
  // once the toggle is used. The English here matches each route's layout.
  'meta.home.title': {
    EN: 'Custom Software, AI and Data Engineering in Tokyo | Neural Point Analytica (NPA)',
    JP: '東京のソフトウェア・AI・データ開発｜Neural Point Analytica (NPA)',
  },
  'meta.home.desc': {
    EN: 'A small software studio in Tokyo. We build web platforms, AI and RAG systems, data pipelines, analytics, internal tools and 3D sites, starting from what each problem actually needs.',
    JP: '東京の小さなソフトウェアスタジオ。Webプラットフォーム、AI・RAG、データパイプライン、分析、社内ツール、3Dサイトまで、課題に本当に必要なものから考えて開発します。',
  },
  'meta.work.title': {
    EN: 'Work (in preparation) | Neural Point Analytica',
    JP: '実績（準備中）｜Neural Point Analytica',
  },
  'meta.work.desc': {
    EN: "Case studies from Neural Point Analytica are on the way. Ask us about what we've built.",
    JP: 'Neural Point Analytica の事例は準備中です。これまでに作ってきたものについては、お気軽にお問い合わせください。',
  },
  'meta.capabilities.title': {
    EN: 'What we do | Neural Point Analytica',
    JP: '対応領域｜Neural Point Analytica',
  },
  'meta.capabilities.desc': {
    EN: 'The kinds of software we build: web platforms, AI and RAG systems, internal tools, data pipelines, analytics, prototypes and interactive 3D sites.',
    JP: 'Webプラットフォーム、AI・RAG、社内ツール、データパイプライン、分析、プロトタイプ、3Dサイトなど、私たちが手がけるソフトウェア。',
  },
  'meta.studio.title': {
    EN: 'Studio | Neural Point Analytica',
    JP: 'スタジオ｜Neural Point Analytica',
  },
  'meta.studio.desc': {
    EN: 'Neural Point Analytica is a small team of engineers in Tokyo. Who we are and how we work.',
    JP: '東京のエンジニアチーム Neural Point Analytica のメンバーと、仕事の進め方。',
  },
  'meta.contact.title': {
    EN: 'Contact | Neural Point Analytica',
    JP: 'お問い合わせ｜Neural Point Analytica',
  },
  'meta.contact.desc': {
    EN: 'Tell us what you are working on. We reply within one business day.',
    JP: '取り組んでいることをお聞かせください。1営業日以内にご返信します。',
  },

  // ---- Footer -----------------------------------------------------------
  'footer.cta': { EN: 'Start a project', JP: '相談する' },
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
