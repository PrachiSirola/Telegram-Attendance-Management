const Employee = require('../models/employee.model');
const Organization = require('../models/organization.model');

const fieldsOf = (select) => select.split(/\s+/).filter(Boolean);
function employeePopulateStages({ select, withOrg = false }) {
  const wanted = fieldsOf(select).filter((f) => f !== 'organizationId');
  const pick = Object.fromEntries(['_id', ...wanted].map((f) => [f, `$$e.${f}`]));
  if (withOrg) pick.organizationId = '$$e.organizationId';

  const stages = [
    {
      $lookup: {
        from: Employee.collection.name,
        localField: 'employeeId',
        foreignField: '_id',
        as: '__e',
      },
    },
    {
      $addFields: {
        employeeId: {
          $let: {
            vars: { e: { $arrayElemAt: ['$__e', 0] } },
            in: { $cond: [{ $eq: [{ $type: '$$e' }, 'object'] }, pick, null] },
          },
        },
      },
    },
  ];
  if (withOrg) {
    stages.push(
      {
        $lookup: {
          from: Organization.collection.name,
          localField: 'employeeId.organizationId',
          foreignField: '_id',
          as: '__o',
        },
      },
      {
        $addFields: {
          employeeId: {
            $cond: [
              { $eq: ['$employeeId', null] },
              null,
              {
                $mergeObjects: [
                  '$employeeId',
                  {
                    organizationId: {
                      $let: {
                        vars: { o: { $arrayElemAt: ['$__o', 0] } },
                        in: { $cond: [{ $eq: [{ $type: '$$o' }, 'object'] }, { _id: '$$o._id', name: '$$o.name', slug: '$$o.slug' }, null] },
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      }
    );
  }
  stages.push({ $project: { __e: 0, __o: 0 } });
  return stages;
}

const logger = require('./logger');
async function listWithEmployee(Model, { filter, sort, skip, limit, select, allOrgs }) {
  const total = Model.countDocuments(filter).exec();
  total.catch(() => {});
  try {
    const items = await Model.aggregate([
      { $match: Model.find(filter).cast(Model) },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      ...employeePopulateStages({ select, withOrg: !!allOrgs }),
    ]);
    return { items, total: await total };
  } catch (err) {
    logger.warn(`aggregate list failed for ${Model.modelName}, using populate: ${err.message}`);
    const populate = allOrgs
      ? { path: 'employeeId', select: `${select} organizationId`, populate: { path: 'organizationId', select: 'name slug' } }
      : { path: 'employeeId', select };
    const items = await Model.find(filter).populate(populate).sort(sort).skip(skip).limit(limit);
    return { items, total: await total };
  }
}

module.exports = { employeePopulateStages, listWithEmployee };