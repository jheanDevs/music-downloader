import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { toast } from "react-hot-toast";
import { getVideoInfo } from "../services/youtube";
import { startDownloads, subscribeToProgress } from "../services/download";
import { useIntersectionObserver } from "../hooks/useIntersectionObserver";
import { FaDownload, FaExchangeAlt, FaCloudDownloadAlt, FaQuestionCircle } from "react-icons/fa";
import { motion } from "framer-motion";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "ConvertMyTube.io" },
    { name: "description", content: "Baixe vídeos do YouTube em MP3 ou MP4" },
  ];
}

export default function Home() {
  const [cardsVisible, setCardsVisible] = useState(false);
  const benefitsRef = useIntersectionObserver({
    onIntersect: () => {
      if (!cardsVisible) {
        setCardsVisible(true);
      }
    }
  });

  const faqRef = useIntersectionObserver({
    onIntersect: () => {
      const items = document.querySelectorAll('.faq-item');
      items.forEach((item, index) => {
        setTimeout(() => {
          item.classList.add('animate-slide-in');
        }, index * 200);
      });
    }
  });
  interface VideoLink {
    url: string;
    title: string;
  }

  const [links, setLinks] = useState<VideoLink[]>([]);
  const [currentLink, setCurrentLink] = useState("");
  const [format, setFormat] = useState("mp3");
  const [downloadState, setDownloadState] = useState({
    isDownloading: false,
    progress: 0,
    status: "",
    currentVideoTitle: "",
    completedDownloads: []
  });

  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<{ url: string; title: string } | null>(null);

  const addLink = async () => {
    if (!currentLink.trim()) return;
    try {
      const videoInfo = await getVideoInfo(currentLink);
      const newVideo = { url: currentLink, title: videoInfo.title };
      setLinks(prevLinks => [...prevLinks, newVideo]);
      setCurrentLink("");
      toast.success("Vídeo adicionado com sucesso!");
    } catch (error) {
      toast.error("Erro ao verificar o vídeo");
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (downloadState.isDownloading) {
      unsubscribe = subscribeToProgress((progress) => {
        setDownloadState(prev => {
          if (progress.status === "completed") {
            toast.success("Downloads concluídos com sucesso!");
            setLinks([]);
            return {
              ...prev,
              isDownloading: false,
              completedDownloads: [...prev.completedDownloads, { title: prev.currentVideoTitle, progress: 100 }],
              currentVideoTitle: "",
              progress: 100,
              status: "Downloads concluídos!"
            };
          }
          return {
            ...prev,
            progress: progress.progress,
            status: progress.status,
            currentVideoTitle: progress.currentVideo || prev.currentVideoTitle
          };
        });
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [downloadState.isDownloading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (links.length === 0) {
      toast.error("Adicione pelo menos um link para download");
      return;
    }

    try {
      setDownloadState({
        isDownloading: true,
        progress: 0,
        status: "Iniciando download...",
        currentVideoTitle: links[0].title,
        completedDownloads: []
      });

      const downloads = links.map(link => ({
        url: link.url,
        title: link.title,
        format
      }));

      await startDownloads(downloads);
    } catch (error) {
      toast.error("Erro ao iniciar os downloads");
      setDownloadState(prev => ({
        ...prev,
        isDownloading: false,
        progress: 0,
        status: "Erro: Falha no download. Por favor, tente novamente.",
        currentVideoTitle: ""
      }));
    }
  };

  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <>
      <nav className="bg-gray-900 text-white px-6 py-4 rounded-xl shadow mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold">ConvertMyTube.io</h1>
        <div className="space-x-4">
          <a href="#beneficios" className="hover:underline">Benefícios</a>
          <a href="#como-usar" className="hover:underline">Como Usar</a>
          <a href="#faq" className="hover:underline">FAQ</a>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8 rounded-xl shadow-lg bg-white dark:bg-gray-900">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-200">ConvertMyTube.io</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">Download de Vídeos do YouTube</p>
        </div>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 mb-12 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-2">
          <label
            htmlFor="links"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
          >
            Links do YouTube
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentLink}
              onChange={(e) => setCurrentLink(e.target.value)}
              placeholder="Cole aqui o link do vídeo"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button
              type="button"
              onClick={addLink}
              disabled={!currentLink.trim() || isConfirming}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors cursor-pointer transform hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {links.map((link, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{link.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{link.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, i) => i !== index))}
                  className="text-red-500 hover:text-red-700 transform hover:scale-105 transition-transform duration-200 cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            Formato
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                value="mp3"
                checked={format === "mp3"}
                onChange={(e) => setFormat(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-gray-700 dark:text-gray-300">MP3</span>
            </label>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                value="mp4"
                checked={format === "mp4"}
                onChange={(e) => setFormat(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-gray-700 dark:text-gray-300">MP4</span>
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={downloadState.isDownloading || links.length === 0}
          className={`w-full ${downloadState.isDownloading || links.length === 0 ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'} text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors transform hover:scale-105 transition-transform duration-200 disabled:opacity-50`}
        >
          {downloadState.isDownloading ? 'Baixando...' : 'Baixar'}
        </button>
      </form>

      {(downloadState.isDownloading || downloadState.completedDownloads.length > 0) && (
        <div className="mt-8 max-w-2xl mx-auto space-y-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          {downloadState.completedDownloads.map((download, index) => (
            <div key={index} className="mb-4">
              <div className="mb-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Download concluído: {download.title}</span>
                <span>100%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-green-600 h-2.5 rounded-full"
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>
          ))}
          {downloadState.currentVideoTitle && (
            <div className="mb-4">
              <div className="mb-3 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{downloadState.currentVideoTitle}</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{downloadState.progress}%</span>
              </div>
              <div className="relative">
                <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 relative"
                    style={{ width: `${downloadState.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{downloadState.status}</p>
              </div>
            </div>
          )}
          {downloadState.completedDownloads.length > 0 && (
            <button
              onClick={() => setDownloadState(prev => ({ ...prev, completedDownloads: [] }))}
              className="w-full mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition transform hover:scale-105 duration-200"
            >
              Limpar Lista
            </button>
          )}
        </div>
      )}

      <div ref={benefitsRef} className="max-w-4xl mx-auto mb-24 text-center" id="beneficios">
        <h2 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-200">Benefícios do ConvertMyTube.io</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`benefit-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <FaDownload className="text-4xl text-blue-500 mb-4 mx-auto" />
            <h3 className="text-xl font-semibold mb-2">Fácil de Usar</h3>
            <p className="text-gray-600 dark:text-gray-400">Cole os links, escolha o formato (MP3 ou MP4) e clique em "Baixar". Simples assim!</p>
          </div>
          <div className={`benefit-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <FaCloudDownloadAlt className="text-4xl text-green-500 mb-4 mx-auto" />
            <h3 className="text-xl font-semibold mb-2">Suporte a Vários Downloads</h3>
            <p className="text-gray-600 dark:text-gray-400">Adicione vários links à lista e baixe todos de uma vez, economizando seu tempo.</p>
          </div>
          <div className={`benefit-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <FaExchangeAlt className="text-4xl text-purple-500 mb-4 mx-auto" />
            <h3 className="text-xl font-semibold mb-2">Conversão Rápida e Segura</h3>
            <p className="text-gray-600 dark:text-gray-400">Arquivos convertidos em segundos, direto do navegador, sem instalar nada.</p>
          </div>
          <div className={`benefit-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <FaExchangeAlt className="text-4xl text-yellow-500 mb-4 mx-auto" />
            <h3 className="text-xl font-semibold mb-2">Áudio ou Vídeo? Você Escolhe!</h3>
            <p className="text-gray-600 dark:text-gray-400">Converta apenas o áudio (MP3) para ouvir offline ou baixe o vídeo completo (MP4).</p>
          </div>
          <div className={`benefit-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <FaDownload className="text-4xl text-red-500 mb-4 mx-auto" />
            <h3 className="text-xl font-semibold mb-2">Alta Qualidade Garantida</h3>
            <p className="text-gray-600 dark:text-gray-400">Desfrute de áudio em alta qualidade para suas músicas ou vídeos em HD.</p>
          </div>
          <div className={`benefit-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <FaCloudDownloadAlt className="text-4xl text-indigo-500 mb-4 mx-auto" />
            <h3 className="text-xl font-semibold mb-2">Progresso em Tempo Real</h3>
            <p className="text-gray-600 dark:text-gray-400">Acompanhe o andamento de cada download diretamente na tela.</p>
          </div>
        </div>
        <section className="max-w-6xl mx-auto py-16 px-4" id="como-usar">
          <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-10">⚙️ Como usar:</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                titulo: '1. Cole os Links',
                descricao: 'Cole os URLs dos vídeos do YouTube que deseja baixar e clique no botão "+" para adicionar à lista.',
              },
              {
                titulo: '2. Escolha o Formato',
                descricao: 'Selecione MP3 para áudio ou MP4 para vídeo. Todos os arquivos serão convertidos no formato escolhido.',
              },
              {
                titulo: '3. Inicie o Download',
                descricao: 'Clique em "Baixar" e aguarde. Você pode acompanhar o progresso de cada download em tempo real.',
              },
            ].map((passo, index) => (
              <motion.div
                key={index}
                className="bg-[#1e2235] p-6 rounded-2xl shadow-md"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <h3 className="text-xl font-semibold text-white mb-2">{passo.titulo}</h3>
                <p className="text-gray-300">{passo.descricao}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      <div ref={faqRef} className="max-w-2xl mx-auto mb-12" id="faq">
        <h2 className="text-2xl font-bold text-center mb-8 text-gray-800 dark:text-gray-200">
          <FaQuestionCircle className="inline-block mr-2 mb-1" />
          Perguntas Frequentes
        </h2>
        <div className="space-y-4">
          {[
            {
              question: "É seguro usar o ConvertMyTube.io?",
              answer: "Sim! Todos os downloads são feitos diretamente do navegador, sem necessidade de instalação. Nós não armazenamos nenhum dado pessoal."
            },
            {
              question: "Preciso instalar algum programa para usar?",
              answer: "Não. O ConvertMyTube.io funciona 100% online. Basta colar o link do vídeo, escolher o formato e clicar em baixar."
            },
            {
              question: "Quais formatos estão disponíveis para download?",
              answer: "Atualmente suportamos os formatos MP3 (áudio) e MP4 (vídeo)."
            },
            {
              question: "Posso converter vários vídeos de uma vez?",
              answer: "Sim! É possível adicionar múltiplos links à lista e fazer o download em sequência, economizando tempo."
            },
            {
              question: "Existe limite de tamanho ou duração dos vídeos?",
              answer: "Vídeos muito longos podem demorar mais para serem processados, mas não há um limite fixo. Recomendamos vídeos de até 2 horas para melhor desempenho."
            },
            {
              question: "O ConvertMyTube.io funciona em celular?",
              answer: "Sim. O site é totalmente responsivo e funciona tanto em computadores quanto em dispositivos móveis."
            },
            {
              question: "O áudio/vídeo tem qualidade reduzida após a conversão?",
              answer: "Não. Garantimos a melhor qualidade possível no formato escolhido (MP3 em alta taxa de bits e MP4 em HD sempre que disponível)."
            },
            {
              question: "É gratuito?",
              answer: "Sim. O ConvertMyTube.io é totalmente gratuito para uso pessoal."
            }
          ].map((faq, index) => (
            <div
              key={index}
              className={`faq-item bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 ${activeFaq === index ? 'shadow-lg' : ''}`}
              onClick={() => toggleFaq(index)}
            >
              <div className="p-4 cursor-pointer flex justify-between items-center">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{faq.question}</h3>
                <span className={`transform transition-transform duration-200 ${activeFaq === index ? 'rotate-180' : ''}`}>▼</span>
              </div>
              <div className={`px-4 pb-4 ${activeFaq === index ? 'block' : 'hidden'}`}>
                <p className="text-gray-600 dark:text-gray-400">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="mt-16 py-8 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            © {new Date().getFullYear()} ConvertMyTube.io - Todos os direitos reservados
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 max-w-2xl mx-auto">
            Aviso: O ConvertMyTube.io respeita os direitos autorais e não incentiva o download de conteúdo protegido.
            Este serviço destina-se apenas para uso pessoal e educacional de conteúdo permitido.
            Os usuários são responsáveis por garantir que seus downloads estejam em conformidade com as leis de direitos autorais aplicáveis.
          </p>
        </div>
      </footer>
    </main>
    </>
  );
}