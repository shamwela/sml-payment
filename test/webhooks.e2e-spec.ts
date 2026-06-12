import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

describe('WebhooksController (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    prisma = moduleFixture.get<PrismaService>(PrismaService)
  })

  beforeEach(async () => {
    await prisma.webhook_events.deleteMany({
      where: { event_id: { contains: 'evt_test' } },
    })
    await prisma.orders.deleteMany({
      where: { external_id: { contains: 'ord_test' } },
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('should process a payment success webhook', async () => {
    await prisma.orders.create({
      data: { external_id: 'ord_test_001', status: 'pending' },
    })

    return request(app.getHttpServer())
      .post('/webhooks/payment')
      .set('x-webhook-secret', process.env.WEBHOOK_SECRET || 'password123')
      .send({
        event_id: 'evt_test_001',
        event_type: 'payment.success',
        order_id: 'ord_test_001',
      })
      .expect(200)
      .expect({ success: true })
  })

  it('should return 200 for duplicate webhook', async () => {
    await prisma.orders.create({
      data: { external_id: 'ord_test_002', status: 'pending' },
    })

    const secret = process.env.WEBHOOK_SECRET || 'password123'

    await request(app.getHttpServer())
      .post('/webhooks/payment')
      .set('x-webhook-secret', secret)
      .send({
        event_id: 'evt_test_002',
        event_type: 'payment.success',
        order_id: 'ord_test_002',
      })
      .expect(200)

    return request(app.getHttpServer())
      .post('/webhooks/payment')
      .set('x-webhook-secret', secret)
      .send({
        event_id: 'evt_test_002',
        event_type: 'payment.success',
        order_id: 'ord_test_002',
      })
      .expect(200)
      .expect({ success: true })
  })

  it('should return 401 for invalid secret', () => {
    return request(app.getHttpServer())
      .post('/webhooks/payment')
      .set('x-webhook-secret', 'wrong-secret')
      .send({
        event_id: 'evt_test_003',
        event_type: 'payment.success',
        order_id: 'ord_test_003',
      })
      .expect(401)
  })

  it('should return 404 for missing order', () => {
    return request(app.getHttpServer())
      .post('/webhooks/payment')
      .set('x-webhook-secret', process.env.WEBHOOK_SECRET || 'password123')
      .send({
        event_id: 'evt_test_004',
        event_type: 'payment.success',
        order_id: 'ord_nonexistent',
      })
      .expect(404)
  })
})
