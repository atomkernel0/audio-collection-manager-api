import compose from "koa-compose";
import ratelimit from "koa-ratelimit";
import authCheck from "./authMiddleware";

//export default compose([authCheck, ratelimit(rateSettings)]);
export default compose([authCheck]);
