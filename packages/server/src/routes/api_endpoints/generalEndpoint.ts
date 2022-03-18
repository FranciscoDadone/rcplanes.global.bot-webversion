// /api/general/<endpoint>

import express from 'express';
import passport from 'passport';
import { authMiddleware } from '../../middlewares/authMiddleware';
import {
  getGeneralConfig,
  getCredentials,
  setCredentials,
  setGeneralConfig,
  getUtil,
} from '../../database/DatabaseQueries';

const bodyParser = require('body-parser');

const router = express.Router();
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

require('../../authentication/passportConfig')(passport);

// -------------------------- END OF MIDDLEWARES -----------------------------

router.get('/general_config', authMiddleware, (req: any, res) => {
  getGeneralConfig().then((data) => {
    res.send(data);
  });
});

router.get('/credentials', authMiddleware, (req: any, res) => {
  getCredentials().then((data) => {
    res.send(data);
  });
});

router.post('/set_credentials', authMiddleware, async (req: any, res) => {
  await setCredentials(
    req.body.data.accessToken,
    req.body.data.clientSecret,
    req.body.data.clientId,
    req.body.data.igAccountId
  ).catch((err) => {
    if (err) res.sendStatus(500);
  });
  res.sendStatus(200);
});

router.post('/set_general_config', authMiddleware, async (req: any) => {
  await setGeneralConfig(
    req.body.data.uploadRate,
    req.body.data.descriptionBoilerplate,
    req.body.data.hashtagFetchingEnabled
  );
});

router.get('/get_util', authMiddleware, async (req: any, res) => {
  const promise = getUtil();
  promise.then((data) => {
    res.send(data);
  });
  promise.catch((err) => {
    if (err) res.sendStatus(500);
  });
});

module.exports = router;
