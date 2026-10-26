const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/lib/prisma', () => ({user:{findUnique:jest.fn()},tournament:{findMany:jest.fn()},event:{findMany:jest.fn()}}));
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const token = jwt.sign({id:3},process.env.JWT_SECRET);
beforeEach(()=>{jest.resetAllMocks();prisma.user.findUnique.mockResolvedValue({id:3,role:'CUSTOMER',isActive:true});});
test.each([['tournaments','tournament'],['events','event']])('%s list carries only this customer registration and no other participant details', async (route,model)=>{
 prisma[model].findMany.mockResolvedValue([{id:2,registrations:[{id:10,payment:null}]}]);
 const res=await request(app).get('/api/'+route).set('Authorization','Bearer '+token);
 expect(res.status).toBe(200);
 expect(res.body.data[0].registrations).toEqual([{id:10,payment:null}]);
 expect(prisma[model].findMany.mock.calls[0][0].include.registrations).toEqual({where:{userId:3,status:'ACTIVE'},select:{id:true,payment:{select:{status:true}}}});
});
