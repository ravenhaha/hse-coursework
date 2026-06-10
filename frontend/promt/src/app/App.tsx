import { motion } from "motion/react";
import { Lock, Database, Check, Sparkles } from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">

      {/* О нас Section - Variant 2: Timeline */}
      <section id="about" className="py-24 px-6 lg:px-12">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">О нас</h2>
            <p className="text-gray-400 text-lg">Омут памяти — это больше, чем просто сервис. Это пространство, где история сохраняется вечно</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500" />

              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative flex items-center mb-16"
              >
                <div className="w-1/2 pr-12 text-right">
                  <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h4 className="text-2xl font-bold mb-3">Создание</h4>
                    <p className="text-gray-400">Начните с простого — создайте первую запись. Добавьте текст, фото, теги.</p>
                  </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-xl font-bold shadow-lg shadow-cyan-500/50">1</div>
                <div className="w-1/2" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative flex items-center mb-16"
              >
                <div className="w-1/2" />
                <div className="absolute left-1/2 -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xl font-bold shadow-lg shadow-purple-500/50">2</div>
                <div className="w-1/2 pl-12">
                  <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h4 className="text-2xl font-bold mb-3">Организация</h4>
                    <p className="text-gray-400">Система автоматически структурирует ваши воспоминания по датам, местам, людям.</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative flex items-center"
              >
                <div className="w-1/2 pr-12 text-right">
                  <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h4 className="text-2xl font-bold mb-3">Погружение</h4>
                    <p className="text-gray-400">Переживайте моменты заново. Находите связи, открывайте новые смыслы.</p>
                  </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-xl font-bold shadow-lg shadow-teal-500/50">3</div>
                <div className="w-1/2" />
              </motion.div>
            </div>

            <div className="text-center mt-16">
              <button className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 rounded-2xl font-semibold transition-all hover:scale-105">
                Начать сейчас
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Возможности Section - Variant 6: Feature Showcase */}
      <section id="features" className="py-24 px-6 lg:px-12">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">Возможности</h2>
            <p className="text-gray-400 text-lg">Откройте для себя инструменты, которые помогают вашим воспоминаниям обрести вторую жизнь</p>
          </div>

          <div className="space-y-16">
            {/* Feature 1 - Хранилище */}
            <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-3xl blur-3xl" />
                <div className="relative backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-12 aspect-square flex items-center justify-center">
                  <Database className="w-32 h-32 text-cyan-400" />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h3 className="text-4xl font-bold mb-4">Безлимитное хранилище</h3>
                <p className="text-gray-400 text-lg mb-6">
                  Сохраняйте неограниченное количество записей, фотографий, видео и аудио. Все данные автоматически синхронизируются между устройствами.
                </p>
                <ul className="space-y-3">
                  {["Фото и видео в полном разрешении", "Голосовые заметки", "PDF и документы", "Автобэкапы"].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-gray-300">
                      <Check className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Feature 2 - AI (замылено, скоро) */}
            <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-2 md:order-1 relative"
              >
                <div className="blur-sm select-none pointer-events-none">
                  <h3 className="text-4xl font-bold mb-4">AI находит всё</h3>
                  <p className="text-gray-400 text-lg mb-6">
                    Забыли где сохранили? Введите любое слово — нейросеть найдет нужную запись даже если она была 5 лет назад.
                  </p>
                  <ul className="space-y-3">
                    {["Поиск по смыслу, не только по словам", "Распознавание текста на фото", "Поиск похожих моментов", "Фильтры по дате, месту, людям"].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-gray-300">
                        <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="px-6 py-3 bg-purple-500/20 border border-purple-500/40 backdrop-blur-sm rounded-2xl text-center">
                    <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                    <span className="text-lg font-bold text-purple-300">Скоро</span>
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative order-1 md:order-2"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl" />
                <div className="relative backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-12 aspect-square flex items-center justify-center overflow-hidden">
                  <Sparkles className="w-32 h-32 text-purple-400 opacity-30" />
                  <div className="absolute inset-0 rounded-3xl backdrop-blur-[3px] bg-[#0a0e1a]/40" />
                </div>
              </motion.div>
            </div>

            {/* Feature 3 - Приватность */}
            <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-3xl blur-3xl" />
                <div className="relative backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-12 aspect-square flex items-center justify-center">
                  <Lock className="w-32 h-32 text-teal-400" />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h3 className="text-4xl font-bold mb-4">Полная приватность</h3>
                <p className="text-gray-400 text-lg mb-6">
                  End-to-end шифрование означает, что даже мы не можем прочитать ваши записи. Только вы имеете доступ к своим воспоминаниям.
                </p>
                <ul className="space-y-3">
                  {["Шифрование AES-256", "Двухфакторная аутентификация", "Биометрический вход", "Zero-knowledge архитектура"].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-gray-300">
                      <Check className="w-5 h-5 text-teal-400 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
