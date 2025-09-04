import { useContext } from 'react';
import { AppModelContext } from '@/providers/app/AppModelProvider';
export function useAppModel() {
    const context = useContext(AppModelContext);
    return context?.appModel;
}
