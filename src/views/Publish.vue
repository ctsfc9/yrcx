const handlePublish = async () => { 
    submitLoading.value = true; 
    
    const cachedStr = localStorage.getItem('user_profile');
    if (!cachedStr) {
        showFailToast('未检测到微信登录信息');
        submitLoading.value = false;
        return;
    }
    const cachedUser = JSON.parse(cachedStr);

    const newRide = Object.assign({}, postForm, { 
        user_id: cachedUser.id, 
        date: postForm.date, 
        remark: postForm.remark.join('，') 
    }); 
    if (!newRide.price) newRide.price = '面议';

    try { 
        const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRide) }); 
        const result = await res.json();
        
        // 🌟 核心拦截机制：如果后台发现该用户已被管理员删除
        if (res.status === 401 || result.error === 'USER_DELETED') {
            // 1. 彻底清空本地“幽灵”缓存
            localStorage.removeItem('user_profile');
            // 2. 给出明确提示
            showFailToast('您的账号已变更或被清理，请重新授权登录');
            // 3. 强制退回首页，此时首页发现没缓存，会自动拉起微信授权弹窗
            setTimeout(() => { window.location.href = '/'; }, 1500);
            return;
        }

        if (res.ok) { 
            const topFee = Number(store.sysConfig && store.sysConfig.top_fee) || 0;
            if (topFee > 0) { 
                showDialog({
                    title: postForm.old_id ? '修改成功' : '发布成功', message: `信息已就绪！是否支付 ${topFee} 元置顶增加曝光？`,
                    showCancelButton: true, confirmButtonText: '马上置顶', cancelButtonText: '暂不需要', confirmButtonColor: '#ff6600'
                }).then(() => {
                    requiredFee.value = topFee; payType.value = 'top'; currentPayRideId.value = result.ride_id; showPayModal.value = true;
                }).catch(() => { router.replace('/me'); });
            } else { showSuccessToast(postForm.old_id ? '修改成功' : '发布成功'); router.replace('/me'); }
        } else if (res.status === 402) {
            requiredFee.value = result.fee || 0; payType.value = 'publish'; showPayModal.value = true;
        } else { showFailToast(result.error || '发布失败'); }
    } catch(e) { showFailToast('请求异常'); } 
    finally { submitLoading.value = false; } 
};
