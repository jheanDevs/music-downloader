interface DownloadRequest {
  url: string;
  title: string;
  format: string;
}

interface DownloadProgress {
  id: string;
  progress: number;
  status: string;
}

export async function startDownloads(downloads: DownloadRequest[]): Promise<void> {
  const response = await fetch('http://localhost:8080/api/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(downloads),
  });

  if (!response.ok) {
    throw new Error('Falha ao iniciar downloads');
  }
}

export function subscribeToProgress(onProgress: (progress: DownloadProgress) => void): () => void {
  const eventSource = new EventSource('http://localhost:8080/api/progress');

  eventSource.onmessage = (event) => {
    const progress: DownloadProgress = JSON.parse(event.data);
    onProgress(progress);
  };

  eventSource.onerror = () => {
    console.error('Erro na conexão com o servidor de progresso');
    eventSource.close();
  };

  return () => eventSource.close();
}