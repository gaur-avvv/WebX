package kafka

import (
	"context"
	"log"

	"github.com/segmentio/kafka-go"
	"github.com/zenith/notification-service/internal/websocket"
)

type Consumer struct {
	Reader *kafka.Reader
	Hub    *websocket.Hub
}

func NewConsumer(brokers []string, topics []string, hub *websocket.Hub) *Consumer {
	return &Consumer{
		Reader: kafka.NewReader(kafka.ReaderConfig{
			Brokers:  brokers,
			GroupID:  "notification-service-group",
			Topic:     topics[0], // Simplified for this demo to one topic, or use a multi-topic reader
			MinBytes:  10e3, // 10KB
			MaxBytes:  10e6, // 10MB
		}),
		Hub: hub,
	}
}

func (c *Consumer) Start(ctx context.Context) {
	log.Printf("Kafka consumer started on topic %s", c.Reader.Config().Topic)
	for {
		m, err := c.Reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("Kafka read error: %v", err)
			continue
		}

		log.Printf("Received message from Kafka: %s", string(m.Value))
		// Broadcast the raw Kafka value (JSON) directly to all connected WebSocket clients
		c.Hub.Broadcast(m.Value)
	}
}

func (c *Consumer) Close() error {
	return c.Reader.Close()
}
