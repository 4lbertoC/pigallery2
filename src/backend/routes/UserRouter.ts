import { UserMWs } from '../middlewares/user/UserMWs';
import { Express } from 'express';
import { UserRoles } from '../../common/entities/UserDTO';
import { AuthenticationMWs } from '../middlewares/user/AuthenticationMWs';
import { UserRequestConstrainsMWs } from '../middlewares/user/UserRequestConstrainsMWs';
import { RenderingMWs } from '../middlewares/RenderingMWs';
import { ServerTimingMWs } from '../middlewares/ServerTimingMWs';
import { Config } from '../../common/config/private/Config';

export class UserRouter {
  public static route(app: Express): void {
    this.addLogin(app);
    this.addLogout(app);
    this.addGetSessionUser(app);

    this.addCreateUser(app);
    this.addDeleteUser(app);
    this.addListUsers(app);
    this.addChangeRole(app);
  }

  private static addLogin(app: Express): void {
    app.post(
      Config.Client.apiPath + '/user/login',
      AuthenticationMWs.inverseAuthenticate,
      AuthenticationMWs.login,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderSessionUser
    );
  }

  private static addLogout(app: Express): void {
    app.post(
      Config.Client.apiPath + '/user/logout',
      AuthenticationMWs.logout,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderOK
    );
  }

  private static addGetSessionUser(app: Express): void {
    app.get(
      Config.Client.apiPath + '/user/me',
      AuthenticationMWs.authenticate,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderSessionUser
    );
  }

  private static addCreateUser(app: Express): void {
    app.put(
      Config.Client.apiPath + '/user',
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.Admin),
      UserMWs.createUser,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderOK
    );
  }

  private static addDeleteUser(app: Express): void {
    app.delete(
      Config.Client.apiPath + '/user/:id',
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.Admin),
      UserRequestConstrainsMWs.notSelfRequest,
      UserMWs.deleteUser,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderOK
    );
  }

  private static addListUsers(app: Express): void {
    app.get(
      Config.Client.apiPath + '/user/list',
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.Admin),
      UserMWs.listUsers,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderResult
    );
  }

  private static addChangeRole(app: Express): void {
    app.post(
      Config.Client.apiPath + '/user/:id/role',
      AuthenticationMWs.authenticate,
      AuthenticationMWs.authorise(UserRoles.Admin),
      UserRequestConstrainsMWs.notSelfRequestOr2Admins,
      UserMWs.changeRole,
      ServerTimingMWs.addServerTiming,
      RenderingMWs.renderOK
    );
  }
}
