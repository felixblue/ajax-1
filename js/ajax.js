/**
 * @overview ajax操作模块（包括jsonp）
 * @author mile 295504163@qq.com
 * @createDate 2016-08-01
 * @lastModifiedDate 2016-09-26
 * @lastModifiedBy mile
 * @version 0.0.1
 */
;(function (global, undefined) {

    'use strict';

    if (global.ajax) {
        return;
    }

    var xhr = null,
        is_timeout = false, //超时标识
        timer = null, //计时器
        is_function = function (obj) {
            return Object.prototype.toString.call(obj) === '[object Function]';
        };

    /**
     * 设置参数中的data数据
     * @param {Object} args 过滤后最终设置的参数
     */
    function set_data(args) {

        var i,
            len,
            key,
            value,
            name,
            arr = [];

        if (args && args.data) {
            if (typeof args.data === 'string') {
                args.data = args.data.split('&');
                for (i = 0, len = args.data.length; i < len; i++) {
                    key = args.data[i].split('=')[0];
                    value = args.data[i].split('=')[1];
                    args.data[i] = encodeURIComponent(key) + '=' + encodeURIComponent(value);
                }
                args.data = args.data.join('&');
            } else if (typeof args.data === 'object') {
                for (name in args.data) {
                    if(args.data && args.data[name]){
                        value = args.data[name].toString();
                        name = encodeURIComponent(name);
                        value = encodeURIComponent(value);
                        arr.push(name + '=' + value);
                    }
                }
                args.data = arr.join('&');
            }
            if (args.type === 'get' || args.data_type === 'jsonp') {
                args.url += args.url.indexOf('?') > -1 ? '&' + args.data : '?' + args.data;
            }
        }
    }

    /**
     * 返回后的数据处理
     * @param {Object/String} data 需要处理的数据
     * @return {Object} data 处理后返回的数据对象
     */
    function deal_data(data) {
        if (typeof data === 'object') {
            return data;
        } else {
            if (window.JSON && window.JSON.parse) {
                return window.JSON.parse(data);
            } else {
                try {
                    return (new Function('return ' + data))();
                } catch (e) {
                    throw new Error('错误名字：' + e.name + '.错误信息：' + e.message);
                    return data;
                }
            }
        }
    }

    /**
     * 设置计时器
     * @param {Object} args 设置的参数
     * @param {Object} obj 需要用的jsonp中的数据
     */
    function set_timer(args, obj) {
        if (args && args.timeout) {
            timer = setTimeout(function () {
                if (args.data_type === 'jsonp') {
                    obj.head_tag.removeChild(obj.script);
                } else {
                    is_timeout = true;
                    xhr && xhr.abort();
                }
                args.error('无状态码', '请求超时');
                args.complete();
            }, args.timeout);
        }
    }

    /**
     * jsonp实现
     * @param {Object} args 设置的参数
     */
    function create_jsonp(args) {

        var script = document.createElement('script'),
            head_tag = document.getElementsByTagName('head')[0],
            time_name = new Date().getTime() + Math.round(Math.random() * 1000),
            callback = 'JSONP_' + time_name;

        window[callback] = function (data) {
            clearTimeout(timer);
            try{ //IE低版本BUG
                delete window[callback];
            }catch(e){
                window[callback] = null;
            }
            head_tag.removeChild(script);
            args.success(data);
            args.complete();
        }

        script.src = args.url + (args.url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + callback;
        script.type = 'text/javascript';
        head_tag.appendChild(script);
        set_timer(args, {
            callback: callback,
            script: script,
            head_tag: head_tag
        });
    }

    /**
     * XHR实现
     * @param {Object} args 设置的参数
     */
    function create_xhr(args) {

        var i,
            version,
            get_xhr = function () {
                //由于IE6的XMLHttpRequest对象是通过MSXML库中的一个ActiveX对象实现的。所以创建XHR对象，需要在这里做兼容处理。
                if (window.XMLHttpRequest) {
                    return new XMLHttpRequest();
                } else {
                    //遍历IE中不同版本的ActiveX对象
                    version = ['Microsoft', 'msxm3', 'msxml2', 'msxml1'];
                    for (i = 0; i < version.length; i++) {
                        try {
                            return new ActiveXObject(version[i] + '.XMLHTTP');
                        } catch (e) {}
                    }
                }
            };

        xhr = get_xhr();
        xhr.open(args.type, args.url, args.async);
        if (args.type === 'post' && !args.content_type) {
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=gbk');
        } else if (args.content_type) {
            xhr.setRequestHeader('Content-Type', args.content_type);
        }
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (args && args.timeout) {
                    //由于执行abort()方法后，有可能触发onreadystatechange事件，所以设置一个is_timeout标识，来忽略中止触发的事件。
                    if (is_timeout) {
                        return;
                    }
                    clearTimeout(timer);
                }
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {
                    args.success(deal_data(xhr.responseText));
                } else {
                    args.error(xhr.status, xhr.statusText);
                }
                args.complete();
            }
        };
        xhr.send(args.type === 'get' ? null : args.data);
        set_timer(args);
    }

    /**
     * 自定义ajax入口
     * @param {Object} args 参数对象，各参数如下：
     * @param {String} url 请求网址
     * @param {String} type 方法，默认值:'GET'
     * @param {Object/String} data 请求的数据
     * @param {String} contentType 请求头
     * @param {String} dataType 请求的类型 ，可选'json/jsonp'
     * @param {Boolean} async 是否异步
     * @param {Number} timeout 超时时间 @注：xhr可用，jsonp不可用
     * @param {Function} before 发送之前执行的函数，可接收过滤后的参数
     * @param {Function} error 请求报错执行的函数，可接收失败的状态码和状态信息
     * @param {Function} success 请求成功的回调函数，可接收成功之后返回的数据
     * @param {Function} complete 无论成功失败都会执行的回调
     */
    function ajax(args) {
        var options = {
            url: args.url || '',
            type: args.type || 'GET',
            data: args.data || null,
            content_type: args.contentType || '',
            data_type: args.dataType || '',
            timeout: args.timeout,
            async: args.async === undefined ? true : !!args.async,
            before: args.before || function () {},
            error: args.error || function () {},
            success: args.success || function () {},
            complete: args.complete || function () {}
        };
        options.type = options.type.toLowerCase();
        set_data(options);
        options.before(options);
        if (options.data_type === 'jsonp') {
            create_jsonp(options);
        } else {
            create_xhr(options);
        }
    }

    global.ajax = ajax;
    /**
     * get方法封装
     * @param {String} url 请求网址
     * @param {Object/String} data 请求的数据
     * @param {Function} success 请求成功的回调函数
     * @param {String} dataType 请求的类型 ，可选'json/jsonp'
     */
    global.ajax.get = function (url, data, success, dataType) {

        if (is_function(data)) {
            if(typeof success == 'string'){
                dataType = success;
            }
            success = data;
            data = null;
        }

        ajax({
            url: url,
            type:'GET',
            data: data,
            dataType: dataType,
            success: success
        });
    }

    /**
     * post方法封装
     * @param {String} url 请求网址
     * @param {Object/String} data 请求的数据
     * @param {Function} success 请求成功的回调函数
     * @param {String} dataType 请求的类型 ，可选'json/jsonp'
     */
    global.ajax.post = function (url, data, success, dataType) {

        if (is_function(data)) {
            if(typeof success == 'string'){
                dataType = success;
            }
            success = data;
            data = null;
        }

        ajax({
            url: url,
            type: 'POST',
            data: data || null,
            dataType: dataType,
            success: success
        });
    }

})(this);
