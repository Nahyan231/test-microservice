import cashToGoodBalanceModel from '../model/cashToGoodBalanceModel';
class cashToGoodService {
  constructor() {
    this.categoryWiseBalance = this.categoryWiseBalance.bind(this);
  }
  async categoryWiseBalance(msisdn, category_id) {
    try {

      let categoryBalanceList = [];
      category_id = parseInt(category_id);
      let query = { msisdn: msisdn };
      if (category_id) {
        query.category_id = category_id;
      }
      categoryBalanceList = await cashToGoodBalanceModel.find(query);
      if (!categoryBalanceList || categoryBalanceList.length == 0) {
        let balanceObj = [{
          Category_id: category_id,
          Category: "",
          Total: 0,
          Consumed: 0,
          Available: 0
        }];
        return balanceObj;
      }

      let categoryBalanceListMapped = categoryBalanceList.map((obj) => {

        let balanceObj = {
          Category_id: obj.category_id,
          Category: obj.category,
          Total: obj.receivings,
          Consumed: obj.consumptions,
          Available: obj.balance
        }
        return balanceObj
      });

      return categoryBalanceListMapped;
      // let promises = [];
      // promises.push(await cashToGoodReceivingModel.aggregate([
      //   // First Stage
      //   {
      //     $match: { receiverMsisdn: msisdn, category_id: category_id }
      //   },
      //   // Second Stage
      //   {
      //     $group: {
      //       _id: "$category",
      //       total: { $sum: "$amount" },
      //       category_id: { "$first": "$category_id" }
      //     }
      //   }
      // ]));
      // promises.push(await cashToGoodConsumptionModel.aggregate([
      //   // First Stage
      //   {
      //     $match: { receiverMsisdn: msisdn, category_id: category_id }
      //   },
      //   // Second Stage
      //   {
      //     $group: {
      //       _id: "$category",
      //       consumed: { $sum: "$amount" },
      //       category_id: { "$first": "$category_id" }
      //     }
      //   }
      // ]));
      // let result = await Promise.allSettled(promises);
      // let total = result[0].value;
      // let consumed = result[1].value;
      // let balanceObj = {};
      // if (total.length > 0) {
      //   if (consumed.length > 0) {
      //     balanceObj = {
      //       Category_id: total[0].category_id,
      //       Category: total[0]._id,
      //       Total: total[0].total,
      //       Consumed: consumed[0].consumed,
      //       Available: total[0].total - consumed[0].consumed
      //     };
      //     return balanceObj;
      //   }
      //   else {
      //     balanceObj = {
      //       Category_id: total[0].category_id,
      //       Category: total[0]._id,
      //       Total: total[0].total,
      //       Consumed: 0,
      //       Available: total[0].total
      //     };
      //     return balanceObj;
      //   }
      // }
      // else {
      //   balanceObj = {
      //     Category_id: category_id,
      //     Category: "",
      //     Total: 0,
      //     Consumed: 0,
      //     Available: 0
      //   };
      //   return balanceObj;
      // }
    } catch (error) {
      let balanceObj = [{
        Category_id: category_id,
        Category: "",
        Total: 0,
        Consumed: 0,
        Available: 0
      }];
      return balanceObj;
      //return error;
    }
  }
}

export default new cashToGoodService();
