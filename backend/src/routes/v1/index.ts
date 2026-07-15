import { Router } from 'express';
import { authRouter } from './auth.routes';
import { permissionRouter } from './permission.routes';
import { roleRouter } from './role.routes';
import { userRouter } from './user.routes';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/permissions', permissionRouter);
v1Router.use('/roles', roleRouter);
v1Router.use('/users', userRouter);
