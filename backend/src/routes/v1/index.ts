import { Router } from 'express';
import { authRouter } from './auth.routes';
import { permissionRouter } from './permission.routes';
import { roleRouter } from './role.routes';
import { userRouter } from './user.routes';
import { auditLogRouter } from './auditLog.routes';
import { simulatorRouter } from './simulator.routes';
import { policyRouter } from './policy.routes';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/permissions', permissionRouter);
v1Router.use('/roles', roleRouter);
v1Router.use('/users', userRouter);
v1Router.use('/audit-logs', auditLogRouter);
v1Router.use('/simulator', simulatorRouter);
v1Router.use('/policies', policyRouter);
