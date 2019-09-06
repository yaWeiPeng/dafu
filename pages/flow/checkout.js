const App = getApp();

// 工具类
import Util from '../../utils/util.js';

// 枚举类：发货方式
import DeliveryTypeEnum from '../../utils/enum/DeliveryType.js';

// 枚举类：支付方式
import PayTypeEnum from '../../utils/enum/order/PayType'

Page({

  /**
   * 页面的初始数据
   */
  data: {

    // 当前页面参数
    options: {},

    // 系统设置：配送方式
    deliverySetting: [],

    // 配送方式
    isShowTab: false,
    DeliveryTypeEnum,
    curDelivery: null,

    // 支付方式
    PayTypeEnum,
    curPayType: PayTypeEnum.WECHAT.value,

    address: null, // 默认收货地址
    exist_address: false, // 是否存在收货地址

    selectedShopId: 0, // 选择的自提门店id
    linkman: '', // 自提联系人
    phone: '', // 自提联系电话

    // 商品信息
    goods: {},

    // 选择的优惠券
    selectCoupon: {
      index: null,
      couponId: null,
      reduced_price: '0.00'
    },

    // 买家留言
    remark: '',

    // 禁用submit按钮
    disabled: false,

    hasError: false,
    error: '',
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // console.log(options);
    let _this = this;
    // 当前页面参数
    _this.data.options = options;
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    let _this = this;
    // 获取当前订单信息
    _this.getOrderData();
  },

  /**
   * 获取当前订单信息
   */
  getOrderData() {
    let _this = this,
      options = _this.data.options;
    // 获取订单信息回调方法
    let callback = result => {
      let resData = result.data;
      // 请求错误
      if (result.code !== 1) {
        App.showError(result.msg);
        return false;
      }
      // 显示错误信息
      if (resData.has_error) {
        _this.data.hasError = true;
        _this.data.error = resData.error_msg;
        App.showError(_this.data.error);
      }
      // 当前选择的配送方式
      resData.curDelivery = resData.delivery ? resData.delivery : resData.deliverySetting[0];
      // 如果只有一种配送方式则不显示选项卡
      resData.isShowTab = resData.deliverySetting.length > 1;
      // 设置页面数据
      _this.setData(resData);
    };
    // 立即购买
    if (options.order_type === 'buyNow') {
      App._get('order/buyNow', {
        goods_id: options.goods_id,
        goods_num: options.goods_num,
        goods_sku_id: options.goods_sku_id,
        delivery: _this.data.curDelivery || 0,
        shop_id: _this.data.selectedShopId || 0,
      }, result => {
        callback(result);
      });
    }
    // 购物车结算
    else if (options.order_type === 'cart') {
      App._get('order/cart', {
        cart_ids: options.cart_ids || 0,
        delivery: _this.data.curDelivery || 0,
        shop_id: _this.data.selectedShopId || 0,
      }, result => {
        callback(result);
      });
    }
  },

  /**
   * 切换配送方式
   */
  onSwichDelivery(e) {
    // 设置当前配送方式
    let _this = this,
      curDelivery = e.currentTarget.dataset.current;
    _this.setData({
      curDelivery
    });
    // 重新获取订单信息
    _this.getOrderData();
  },

  /**
   * 快递配送：选择收货地址
   */
  onSelectAddress() {
    wx.navigateTo({
      url: '../address/' + (this.data.exist_address ? 'index?from=flow' : 'create')
    });
  },

  /**
   * 上门自提：选择自提点
   */
  onSelectExtractPoint() {
    let _this = this,
      selectedId = _this.data.selectedShopId;
    wx.navigateTo({
      url: '../_select/extract_point/index?selected_id=' + selectedId
    });
  },

  /**
   * 订单提交
   */
  submitOrder() {
    let _this = this,
      options = _this.data.options;

    if (_this.data.disabled) {
      return false;
    }

    if (_this.data.hasError) {
      App.showError(_this.data.error);
      return false;
    }

    // 订单创建成功后回调--微信支付
    let callback = result => {
      if (result.code === -10) {
        App.showError(result.msg, function() {
          _this.redirectToOrderIndex();
        });
        return false;
      }

      // 发起微信支付
      if (result.data.pay_type == PayTypeEnum.WECHAT.value) {
        App.wxPayment({
          payment: result.data.payment,
          success: res => {
            _this.redirectToOrderIndex();
          },
          fail: res => {
            App.showError('订单未支付', function() {
              _this.redirectToOrderIndex();
            });
          },
        });
      }
      // 余额支付
      if (result.data.pay_type == PayTypeEnum.BALANCE.value) {
        App.showSuccess('支付成功', () => {
          _this.redirectToOrderIndex();
        });
      }
    };

    // 按钮禁用, 防止二次提交
    _this.data.disabled = true;

    // 显示loading
    wx.showLoading({
      title: '正在处理...'
    });

    // 表单提交的数据
    let postData = {
      delivery: _this.data.curDelivery,
      pay_type: _this.data.curPayType,
      shop_id: _this.data.selectedShopId || 0,
      linkman: _this.data.linkman,
      phone: _this.data.phone,
      coupon_id: _this.data.selectCoupon.couponId || 0,
      remark: _this.data.remark,
    };

    // 创建订单-立即购买
    if (options.order_type === 'buyNow') {
      App._post_form('order/buyNow', Object.assign({
        goods_id: options.goods_id,
        goods_num: options.goods_num,
        goods_sku_id: options.goods_sku_id,
      }, postData), result => {
        // success
        console.log('success');
        callback(result);
      }, result => {
        // fail
        console.log('fail');
      }, () => {
        // complete
        console.log('complete');
        wx.hideLoading();
        // 解除按钮禁用
        _this.data.disabled = false;
      });
    }

    // 创建订单-购物车结算
    else if (options.order_type === 'cart') {
      App._post_form('order/cart', Object.assign({
        cart_ids: options.cart_ids || 0,
      }, postData), result => {
        // success
        console.log('success');
        callback(result);
      }, result => {
        // fail
        console.log('fail');
      }, () => {
        // complete
        console.log('complete');
        wx.hideLoading();
        // 解除按钮禁用
        _this.data.disabled = false;
      });
    }

  },

  /**
   * 买家留言
   */
  bindRemark(e) {
    this.setData({
      remark: e.detail.value
    })
  },

  /**
   * 选择优惠券(弹出/隐藏)
   */
  onTogglePopupCoupon() {
    let _this = this;
    if (_this.data.coupon_list.length > 0) {
      _this.setData({
        showBottomPopup: !_this.data.showBottomPopup
      });
    }
  },

  /**
   * 选择优惠券
   */
  selectCouponTap(e) {
    let _this = this,
      dataset = e.currentTarget.dataset;
    // 优惠券折扣金额
    let reducedPrice = _this.data.coupon_list[dataset.index].reduced_price;
    dataset.reduced_price = reducedPrice;
    // 计算优惠后的价格
    let actualPayPrice = _this.bcsub(_this.data.order_pay_price, reducedPrice);
    _this.setData({
      selectCoupon: dataset,
      actual_pay_price: actualPayPrice > 0 ? actualPayPrice : '0.01'
    });
    _this.onTogglePopupCoupon();
  },

  /**
   * 不使用优惠券
   */
  doNotCouponTap() {
    this.setData({
      selectCoupon: {},
      actual_pay_price: this.data.order_pay_price
    });
    this.onTogglePopupCoupon();
  },

  /**
   * 选择支付方式
   */
  onSelectPayType(e) {
    let _this = this;
    // 记录formId
    App.saveFormId(e.detail.formId);
    // 设置当前支付方式
    _this.setData({
      curPayType: e.currentTarget.dataset.value
    });
  },

  /**
   * 数学运算相减
   */
  bcsub(arg1, arg2) {
    return (Number(arg1) - Number(arg2)).toFixed(2);
  },

  /**
   * 跳转到未付款订单
   */
  redirectToOrderIndex() {
    wx.redirectTo({
      url: '../order/index',
    });
  },

  /**
   * input绑定：联系人
   */
  onInputLinkman(e) {
    this.setData({
      linkman: e.detail.value
    });
  },

  /**
   * input绑定：联系电话
   */
  onInputPhone(e) {
    this.setData({
      phone: e.detail.value
    });
  },

});