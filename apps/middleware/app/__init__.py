"""Control-plane middleware for Cordillera.

This service sits in front of the Fastify API as the control plane. Its first
responsibility will be the MercadoPago payment gateway (payment preferences and
webhook handling). For now it only exposes a health endpoint so the container
group can be measured and orchestrated.
"""
