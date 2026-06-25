import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}>

      {/* ヘッダー */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <svg width="90" height="24" viewBox="0 0 110 32" fill="none">
            <rect width="28" height="28" x="0" y="2" rx="6" fill="white"/>
            <rect x="3" y="6" width="4" height="5" rx="1.2" fill="#111"/>
            <rect x="3" y="15" width="4" height="5" rx="1.2" fill="#111"/>
            <rect x="3" y="23" width="4" height="3" rx="1.2" fill="#111"/>
            <rect x="21" y="6" width="4" height="5" rx="1.2" fill="#111"/>
            <rect x="21" y="15" width="4" height="5" rx="1.2" fill="#111"/>
            <rect x="21" y="23" width="4" height="3" rx="1.2" fill="#111"/>
            <rect x="9" y="7" width="10" height="18" rx="2" fill="#111"/>
            <text x="34" y="22" fontFamily="Georgia,serif" fontSize="18" fontWeight="700" fill="white" letterSpacing="-0.5">edit</text>
            <text x="66" y="22" fontFamily="Georgia,serif" fontSize="18" fontWeight="400" fill="#666" letterSpacing="-0.5">view</text>
          </svg>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            ログイン
          </Link>
          <Link href="/register" className="text-sm bg-white text-gray-950 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">
            無料で始める
          </Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-16">
        <div className="flex items-center gap-12">
          {/* 左：画像エリア */}
          <div className="w-[520px] shrink-0 relative">
            <div className="rounded-2xl overflow-hidden border border-gray-800" style={{ aspectRatio: '4/3' }}>
              <img
                src="/images/hero-editor.jpg"
                alt="動画編集画面"
                className="w-full h-full object-cover object-top"
              />
              {/* 暗めのオーバーレイ */}
              <div className="absolute inset-0 bg-black/20 rounded-2xl" />
            </div>

            {/* Editviewロゴオーバーレイ */}
            <div className="absolute top-5 left-5 flex items-center gap-2 bg-black/70 backdrop-blur px-4 py-3 rounded-xl border border-white/10">
              <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="6" fill="white"/>
                <rect x="3" y="5" width="4" height="5" rx="1" fill="#111"/>
                <rect x="3" y="14" width="4" height="5" rx="1" fill="#111"/>
                <rect x="3" y="22" width="4" height="3" rx="1" fill="#111"/>
                <rect x="21" y="5" width="4" height="5" rx="1" fill="#111"/>
                <rect x="21" y="14" width="4" height="5" rx="1" fill="#111"/>
                <rect x="21" y="22" width="4" height="3" rx="1" fill="#111"/>
                <rect x="9" y="6" width="10" height="16" rx="2" fill="#111"/>
              </svg>
              <span className="text-white font-bold text-2xl tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
                edit<span className="text-gray-400 font-normal">view</span>
              </span>
            </div>


          </div>

          {/* 右：テキストエリア */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">動画編集者向け確認ツール</p>
            <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
              クライアントの<br />修正指示を<br />
              <span className="text-gray-500">もっとシンプルに。</span>
            </h1>
            <p className="text-base text-gray-400 mb-10 leading-relaxed">
              動画編集者とクライアントをつなぐ確認ツール。<br />
              タイムコードにコメントできるので、<br />
              修正のやり取りがスムーズになります。
            </p>
            <div className="flex items-center gap-4">
              <Link href="/register" className="bg-white text-gray-950 px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-100 transition-colors">
                無料で始める
              </Link>
              <Link href="/login" className="text-gray-400 hover:text-white transition-colors text-sm">
                すでにアカウントをお持ちの方 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 課題提起 */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-gray-800">
        <p className="text-center text-gray-500 text-sm mb-10 uppercase tracking-widest">こんな経験、ありませんか？</p>
        <div className="flex flex-col gap-3 max-w-lg mx-auto">
          {[
            { icon: '💬', text: '「なんか違う」という曖昧な修正指示が来る' },
            { icon: '🔄', text: 'LINEやメールで修正が何度も往復する' },
            { icon: '😵', text: '「どこのシーンのこと？」と毎回確認が必要' },
          ].map((item, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="text-2xl shrink-0">{item.icon}</div>
              <p className="text-sm text-gray-400">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 機能紹介 */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-gray-800">
        <p className="text-center text-gray-500 text-sm mb-3 uppercase tracking-widest">機能</p>
        <h2 className="text-3xl font-bold text-center mb-14">修正のやり取りが、これだけ変わる</h2>
        <div className="space-y-6">
          {[
            {
              title: 'タイムコードコメント',
              desc: '動画の修正箇所にコメントを。「0:14 テロップを大きくして」のように、どこを指しているか一目瞭然。',
              badge: '編集者 / クライアント',
            },
            {
              title: '修正回数の管理',
              desc: '契約時に決めた修正回数を案件ごとに設定。上限を超えると自動で追加料金をお知らせ。修正回数の認識違いがなくなります。',
              badge: '編集者',
            },
            {
              title: 'パスワード保護された確認画面',
              desc: 'クライアントにはURLとパスワードを送るだけ。登録不要で動画を確認・コメントできます。余計な手間をかけさせません。',
              badge: 'クライアント',
            },
            {
              title: 'メール通知',
              desc: 'クライアントが修正を送信したとき・納品OKを出したときに、編集者のメールに自動で通知が届きます',
              badge: '編集者',
            },
          ].map((f, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-7 flex items-start gap-6">
              <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-lg shrink-0 font-mono font-bold text-gray-300">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-0.5 rounded-full">{f.badge}</span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 使い方の流れ */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-gray-800">
        <p className="text-center text-gray-500 text-sm mb-3 uppercase tracking-widest">使い方</p>
        <h2 className="text-3xl font-bold text-center mb-14">3ステップで始められる</h2>
        <div className="grid grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: '案件を作成',
              desc: '案件名・クライアント名・修正回数を入力。URLとパスワードが自動で発行されます。',
            },
            {
              step: '02',
              title: '動画をアップロード',
              desc: '編集した動画をアップロードして、URLとパスワードをクライアントに送ります。',
            },
            {
              step: '03',
              title: 'コメントを受け取る',
              desc: 'クライアントがタイムコード付きでコメント。修正内容が一目でわかります。',
            },
          ].map((s, i) => (
            <div key={i} className="relative">
              {i < 2 && (
                <div className="absolute top-6 left-full w-full h-px bg-gray-800 -translate-x-3 z-0" />
              )}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative z-10">
                <div className="text-4xl font-bold text-gray-800 mb-4 font-mono">{s.step}</div>
                <h3 className="text-base font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-t border-gray-800 text-center">
        <h2 className="text-3xl font-bold mb-4">今すぐ無料で始める</h2>
        <p className="text-gray-400 mb-10">クレジットカード不要。登録は1分で完了します。</p>
        <Link href="/register" className="inline-block bg-white text-gray-950 px-10 py-4 rounded-xl font-semibold text-base hover:bg-gray-100 transition-colors">
          無料アカウントを作成する
        </Link>
      </section>

      {/* フッター */}
      <footer className="border-t border-gray-800 px-6 py-8 max-w-6xl mx-auto flex items-center justify-between">
        <span className="text-sm text-gray-600">© 2026 Editview</span>
        <div className="flex gap-6">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">ログイン</Link>
          <Link href="/register" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">新規登録</Link>
        </div>
      </footer>

    </div>
  )
}
