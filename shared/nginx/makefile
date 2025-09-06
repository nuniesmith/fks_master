# Makefile - Convenient commands for Docker Compose stack

.PHONY: help deploy stop clean logs status backup monitoring

# Default target
help:
	@echo "7gram NGINX Stack Makefile"
	@echo "========================="
	@echo "make deploy      - Deploy the basic stack"
	@echo "make monitoring  - Deploy with monitoring"
	@echo "make full        - Deploy everything"
	@echo "make stop        - Stop all services"
	@echo "make clean       - Remove everything (including volumes)"
	@echo "make logs        - Show logs"
	@echo "make status      - Show service status"
	@echo "make backup      - Create backup"
	@echo "make ssl-status  - Check SSL certificate status"

# Check prerequisites
check:
	@./deploy.sh check

# Deploy targets
deploy: check
	@./deploy.sh deploy

monitoring: check
	@./deploy.sh deploy monitoring

full: check
	@./deploy.sh deploy "monitoring backup blue-green"

# Management targets
stop:
	@docker-compose down

clean:
	@docker-compose down -v

logs:
	@docker-compose logs -f --tail=100

status:
	@docker-compose ps

backup:
	@./deploy.sh backup

ssl-status:
	@./deploy.sh ssl-status

# Development targets
dev: check
	@docker-compose up

build:
	@docker-compose build --no-cache

pull:
	@docker-compose pull