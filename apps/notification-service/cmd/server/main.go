package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/zenith/notification-service/internal/config"
	"github.com/zenith/notification-service/internal/kafka"
	"github.com/zenith/notification-service/internal/websocket"
)

func main() {
	// 1. Load configuration
	cfg := config.Load()
	log.Printf("🚀 Starting Zenith Notification Service on port %s...", cfg.Port)

	// 2. Initialize WebSocket Hub
	hub := websocket.NewHub()
	go hub.Run()

	// 3. Initialize Kafka Consumer
	// In a full implementation, we would use a multi-topic consumer or multiple consumers.
	// For the MVP, we focus on the primary satellite position topic.
	topics := []string{"zenith.satellite.positions", "zenith.planetary.ephemeris"}
	consumer := kafka.NewConsumer(cfg.KafkaBrokers, topics, hub)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go consumer.Start(ctx)

	// 4. Setup Gin Server
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "notification-service"})
	})

	// WebSocket endpoint
	router.GET("/ws", websocket.HandleWS(hub))

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	// 5. Graceful shutdown
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	cancel()
	consumer.Close()
	if err := srv.Shutdown(context.Background()); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
