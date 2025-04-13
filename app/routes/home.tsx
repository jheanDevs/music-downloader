import { useState, useEffect, useRef } from "react";
import type { Route } from "./+types/home";
import { toast } from "react-hot-toast";
import { getVideoInfo } from "../services/youtube";
import { startDownloads, subscribeToProgress } from "../services/download";
import "../styles/animations.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "YouTube Downloader" },
    { name: "description", content: "Baixe vídeos do YouTube em MP3 ou MP4" },
  ];
}

export default function Home() {
  interface VideoLink {
    url: string;
    title: string;
  }

  interface DownloadHistory {
    title: string;
    format: string;
    status: string;
    timestamp: string;
  }

  const [links, setLinks] = useState<VideoLink[]>([]);
  const [currentLink, setCurrentLink] = useState("");
  const [format, setFormat] = useState("mp3");
  const [downloadState, setDownloadState] = useState({
    isDownloading: false,
    progress: 0,
    status: ""
  });
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistory[]>([]);
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
        setDownloadState(prev => ({
          ...prev,
          progress: progress.progress,
          status: progress.status
        }));

        // Quando o download estiver concluído
        if (progress.progress === 100) {
          toast.success("Download concluído com sucesso!");
          // Adiciona ao histórico antes de limpar a lista
          links.forEach(link => {
            setDownloadHistory(prev => [{
              title: link.title,
              format: format,
              status: "Concluído",
              timestamp: new Date().toLocaleString()
            }, ...prev]);
          });
          setLinks([]); // Limpa a lista de links
          setDownloadState({
            isDownloading: false,
            progress: 100,
            status: "Download Concluído"
          });
        }
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [downloadState.isDownloading, links, format]);

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
        status: "Iniciando download..."
      });

      const downloads = links.map(link => ({
        url: link.url,
        title: link.title,
        format
      }));

      await startDownloads(downloads);
    } catch (error) {
      toast.error("Erro ao iniciar os downloads");
      setDownloadState({
        isDownloading: false,
        progress: 0,
        status: ""
      });
    }
  };

  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in-up');
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);
 
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
        {downloadState.isDownloading ? (
          <div className="text-center">
            <div className="mb-4 relative">
              <div className="w-full bg-gray-200 rounded-full h-6 dark:bg-gray-700 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 h-6 rounded-full relative overflow-hidden transition-all duration-300 ease-in-out transform-gpu"
                  style={{
                    width: `${downloadState.progress}%`,
                    backgroundSize: '200% 100%',
                    animation: 'gradient 2s linear infinite, pulse 1.5s ease-in-out infinite'
                  }}
                >
                  <div className="absolute inset-0 bg-white/30 w-full h-full transform -skew-x-12 animate-shimmer"></div>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow-md">
                    {downloadState.progress}%
                  </span>
                </div>
              </div>
              <style jsx>{`
                @keyframes gradient {
                  0% { background-position: 0% 50%; }
                  50% { background-position: 100% 50%; }
                  100% { background-position: 0% 50%; }
                }
                @keyframes shimmer {
                  0% { transform: translateX(-100%) skewX(-12deg); }
                  100% { transform: translateX(200%) skewX(-12deg); }
                }
                @keyframes pulse {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.02); }
                }
              `}</style>
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 transition-all duration-300">
                  {downloadState.status}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 animate-pulse">
                  {downloadState.progress < 100 ? 'Processando...' : 'Download Concluído!'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={links.length === 0}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-[1.02] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
          >
            Baixar
          </button>
        )}
      
        {downloadHistory.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Histórico de Downloads</h3>
            <div className="space-y-3">
              {downloadHistory.map((item, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{item.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Formato: {item.format.toUpperCase()} | Status: {item.status}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
