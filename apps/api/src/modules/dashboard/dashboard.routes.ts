import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { dashboardController } from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, authorize(UserRole.PATIENT));

dashboardRouter.get('/summary', dashboardController.getSummary);
