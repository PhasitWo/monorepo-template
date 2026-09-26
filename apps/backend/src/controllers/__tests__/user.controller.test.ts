import { makeReply, makeRequest, sent } from '../../__tests__/utils/http';
import { createMock } from '../../__tests__/utils/mockFactory';
import { UserController } from '../user.controller';
import { SafeUser, UserService } from '../../services/user.service';

const user: SafeUser = {
  id: 'u1',
  username: 'alice01',
  name: 'Alice',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
};

describe('UserController', () => {
  let service: jest.Mocked<UserService>;
  let controller: UserController;

  beforeEach(() => {
    service = createMock<UserService>();
    controller = new UserController(service);
  });

  it('never returns the password or deletedAt', async () => {
    // even if a row with a password slipped through, the mapper picks fields explicitly
    service.getById.mockResolvedValue({ ...user, password: 'hash' } as SafeUser);
    const reply = makeReply();

    await controller.getUserById(makeRequest({ params: { id: 'u1' } }), reply);

    expect(Object.keys(sent(reply).data).sort()).toEqual(['createdAt', 'id', 'name', 'updatedAt', 'username']);
  });

  it('creates with 201, lists, updates and deletes with 204', async () => {
    service.create.mockResolvedValue(user);
    service.list.mockResolvedValue({ total: 1, data: [user] });
    service.update.mockResolvedValue(user);
    const [createReply, listReply, pageReply, updateReply, deleteReply] = [
      makeReply(),
      makeReply(),
      makeReply(),
      makeReply(),
      makeReply(),
    ];

    await controller.createUser(
      makeRequest({ body: { name: 'Alice', username: 'alice01', password: 'x' } }),
      createReply,
    );
    await controller.listUsers(makeRequest({ query: { all: 'true' } }), listReply);
    await controller.listUsers(makeRequest({ query: { page: '1' } }), pageReply);
    await controller.updateUser(makeRequest({ params: { id: 'u1' }, body: { name: 'A' } }), updateReply);
    await controller.deleteUser(makeRequest({ params: { id: 'u1' } }), deleteReply);

    expect(createReply.status).toHaveBeenCalledWith(201);
    expect(sent(listReply).data).toHaveLength(1);
    expect(sent(pageReply).meta.pagination).toMatchObject({ page: 1, total: 1 });
    expect(service.update).toHaveBeenCalledWith('u1', { name: 'A' });
    expect(service.delete).toHaveBeenCalledWith('u1');
    expect(deleteReply.status).toHaveBeenCalledWith(204);
  });
});
