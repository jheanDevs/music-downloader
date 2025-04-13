package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
)

type DownloadRequest struct {
	URL    string `json:"url"`
	Title  string `json:"title"`
	Format string `json:"format"`
}

type DownloadProgress struct {
	ID       string  `json:"id"`
	Progress float64 `json:"progress"`
	Status   string  `json:"status"`
}

type DownloadWorker struct {
	requestChan  chan DownloadRequest
	progressChan chan DownloadProgress
	wg           *sync.WaitGroup
}

func NewDownloadWorker(requestChan chan DownloadRequest, progressChan chan DownloadProgress, wg *sync.WaitGroup) *DownloadWorker {
	return &DownloadWorker{
		requestChan:  requestChan,
		progressChan: progressChan,
		wg:          wg,
	}
}

func (w *DownloadWorker) Start() {
	go func() {
		defer w.wg.Done()
		for req := range w.requestChan {
			// Simular progresso do download
			for progress := 0.0; progress <= 100.0; progress += 10.0 {
				w.progressChan <- DownloadProgress{
					ID:       req.URL,
					Progress: progress,
					Status:   fmt.Sprintf("Baixando %s...", req.Title),
				}
			}
		}
	}()
}

func main() {
	requestChan := make(chan DownloadRequest, 100)
	progressChan := make(chan DownloadProgress, 100)
	var wg sync.WaitGroup

	// Iniciar workers
	numWorkers := 3
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		worker := NewDownloadWorker(requestChan, progressChan, &wg)
		worker.Start()
	}

	// Handler para iniciar downloads
	http.HandleFunc("/api/download", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
			return
		}

		var requests []DownloadRequest
		if err := json.NewDecoder(r.Body).Decode(&requests); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Enviar requisições para o canal
		for _, req := range requests {
			requestChan <- req
		}

		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{"status": "Downloads iniciados"})
	})

	// Handler para SSE (Server-Sent Events) para progresso
	http.HandleFunc("/api/progress", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming não suportado", http.StatusInternalServerError)
			return
		}

		for progress := range progressChan {
			data, _ := json.Marshal(progress)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	})

	log.Println("Servidor iniciado na porta 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}