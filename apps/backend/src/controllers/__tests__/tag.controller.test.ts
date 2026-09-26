import { Tag } from '../../.generated/client';
import { NotFoundError } from '../../common/errors/errorTypes';
import { makeReply, makeRequest, sent } from '../../__tests__/utils/http';
import { createMock } from '../../__tests__/utils/mockFactory';
import { TagController } from '../tag.controller';
import { TagService } from '../../services/tag.service';

const tag: Tag = {
  id: 't1',
  runningId: 1,
  runningCode: 'T000001',
  name: 'Urgent',
  description: null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('TagController', () => {
  let service: jest.Mocked<TagService>;
  let controller: TagController;

  beforeEach(() => {
    service = createMock<TagService>();
    controller = new TagController(service);
  });

  it('maps the record with ISO dates', async () => {
    service.getById.mockResolvedValue(tag);
    const reply = makeReply();

    await controller.getTagById(makeRequest({ params: { id: 't1' } }), reply);

    expect(sent(reply).data).toEqual({
      id: 't1',
      runningId: 1,
      runningCode: 'T000001',
      name: 'Urgent',
      description: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('propagates NotFoundError from the service', async () => {
    service.getById.mockRejectedValue(new NotFoundError('Tag not found'));

    await expect(controller.getTagById(makeRequest({ params: { id: 't1' } }), makeReply())).rejects.toThrow(
      NotFoundError,
    );
  });

  it('lists with isActive parsed to a boolean', async () => {
    service.list.mockResolvedValue({ total: 1, data: [tag] });
    const reply = makeReply();

    await controller.listTag(makeRequest({ query: { isActive: 'false', search: 'urg' } }), reply);

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ isActive: false, search: 'urg', page: 1 }));
    expect(sent(reply).meta.pagination).toMatchObject({ total: 1, totalPages: 1 });
  });

  it('returns a plain list when all=true', async () => {
    service.list.mockResolvedValue({ total: 1, data: [tag] });
    const reply = makeReply();

    await controller.listTag(makeRequest({ query: { all: 'true' } }), reply);

    expect(sent(reply).meta).toBeUndefined();
    expect(sent(reply).data).toHaveLength(1);
  });

  it('creates with 201 and updates with 200', async () => {
    service.create.mockResolvedValue(tag);
    service.update.mockResolvedValue(tag);
    const createReply = makeReply();
    const updateReply = makeReply();

    await controller.createTag(makeRequest({ body: { name: 'Urgent' } }), createReply);
    await controller.updateTag(makeRequest({ params: { id: 't1' }, body: { isActive: false } }), updateReply);

    expect(createReply.status).toHaveBeenCalledWith(201);
    expect(service.update).toHaveBeenCalledWith('t1', { isActive: false });
    expect(updateReply.status).toHaveBeenCalledWith(200);
  });
});
