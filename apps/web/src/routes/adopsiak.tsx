import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/lib/auth-client';
import { orpc } from '@/utils/orpc';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

export const Route = createFileRoute('/adopsiak')({
    component: AdopsiakRoute,
});

const formSchema = z.object({
    cityOrMunicipality: z.string().min(1, 'City/Municipality is required'),
    shippingAddress: z.string().min(1, 'Shipping address is required'),
    delegateName: z.string().min(1, 'Delegate name is required'),
    delegatePhone1: z
        .string()
        .min(1, 'Phone number is required')
        .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone format (e.g., +48600700800)'),
    delegatePhone2: z
        .string()
        .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone format')
        .optional()
        .or(z.literal('')),
    librariesCount: z.coerce.number().min(0).default(0),
    kindergartensCount: z.coerce.number().min(0).default(0),
    deliveryDate: z.string().optional(),
    protocolText: z.string().optional(),
    protocolEmailRecipient: z
        .string()
        .email('Invalid email')
        .optional()
        .or(z.literal('')),
    email: z.string().email('Email is required'),
});

function AdopsiakRoute() {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

    const createMutation = useMutation(
        orpc.adopsiak.create.mutationOptions({
            onSuccess: () => {
                toast.success('Order submitted successfully!');
                const form = document.querySelector('form') as HTMLFormElement;
                if (form) form.reset();
                setEmail('');
                setOtp('');
                setOtpSent(false);
                setEmailVerified(false);
            },
            onError: (error) => {
                toast.error(`Failed to submit order: ${error.message}`);
            },
        }),
    );

    const handleSendOtp = async () => {
        if (!email) {
            toast.error('Please enter an email address');
            return;
        }
        setIsSendingOtp(true);
        try {
            await authClient.emailOtp.sendVerificationOtp({
                email,
                type: 'email-verification',
            });
            setOtpSent(true);
            toast.success('Verification code sent to your email');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to send verification code';
            toast.error(message);
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) {
            toast.error('Please enter the verification code');
            return;
        }
        setIsVerifyingOtp(true);
        try {
            // Note: In a real app, this would verify the OTP.
            // Since we don't have a full user session flow here, we might need a custom endpoint
            // or assume the client-side check is enough for this demo if better-auth doesn't support
            // verifying without signing in.
            // However, better-auth emailOTP usually signs the user in.
            // Let's try to verify.
            const res = await authClient.emailOtp.verifyEmail({
                email,
                otp,
            });
            if (res.error) {
                throw new Error(res.error.message);
            }
            setEmailVerified(true);
            toast.success('Email verified successfully');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to verify code';
            toast.error(message);
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!emailVerified) {
            toast.error('Please verify your email first');
            return;
        }

        const formData = new FormData(e.currentTarget);

        const data = {
            cityOrMunicipality: formData.get('cityOrMunicipality') as string,
            shippingAddress: formData.get('shippingAddress') as string,
            delegateName: formData.get('delegateName') as string,
            delegatePhone1: formData.get('delegatePhone1') as string,
            delegatePhone2: (formData.get('delegatePhone2') as string) || undefined,
            librariesCount: Number(formData.get('librariesCount') || 0),
            kindergartensCount: Number(formData.get('kindergartensCount') || 0),
            deliveryDate: (formData.get('deliveryDate') as string) || undefined,
            protocolText: (formData.get('protocolText') as string) || undefined,
            protocolEmailRecipient:
                (formData.get('protocolEmailRecipient') as string) || undefined,
            email: email,
        };

        const result = formSchema.safeParse(data);

        if (!result.success) {
            const firstIssue = result.error.issues[0];
            toast.error(`${firstIssue.path.join('.')}: ${firstIssue.message}`);
            return;
        }

        createMutation.mutate({
            ...result.data,
            totalInstitutions:
                result.data.librariesCount + result.data.kindergartensCount,
        });
    };

    return (
        <div className="mx-auto w-full max-w-2xl py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Adopsiak Order Form</CardTitle>
                    <CardDescription>Submit a new order for Adopsiak</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-6">
                        {/* Email Verification Section */}
                        <div className="space-y-4 rounded-md border p-4">
                            <h3 className="text-lg font-medium">Email Verification</h3>
                            <div className="flex items-end gap-2">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="email@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={emailVerified || otpSent}
                                    />
                                </div>
                                {!emailVerified && !otpSent && (
                                    <Button
                                        type="button"
                                        onClick={handleSendOtp}
                                        disabled={isSendingOtp || !email}
                                    >
                                        {isSendingOtp ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            'Send Code'
                                        )}
                                    </Button>
                                )}
                            </div>

                            {otpSent && !emailVerified && (
                                <div className="flex items-end gap-2">
                                    <div className="flex-1 space-y-2">
                                        <Label htmlFor="otp">Verification Code</Label>
                                        <Input
                                            id="otp"
                                            placeholder="123456"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleVerifyOtp}
                                        disabled={isVerifyingOtp || !otp}
                                    >
                                        {isVerifyingOtp ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            'Verify Code'
                                        )}
                                    </Button>
                                </div>
                            )}

                            {emailVerified && (
                                <div className="text-sm text-green-600">
                                    Email verified successfully!
                                </div>
                            )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="cityOrMunicipality">City / Municipality</Label>
                                <Input
                                    id="cityOrMunicipality"
                                    name="cityOrMunicipality"
                                    placeholder="Warszawa"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delegateName">Delegate Name</Label>
                                <Input
                                    id="delegateName"
                                    name="delegateName"
                                    placeholder="Jan Kowalski"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="shippingAddress">Shipping Address</Label>
                            <Textarea
                                id="shippingAddress"
                                name="shippingAddress"
                                placeholder="ul. Przykładowa 1, 00-000 Warszawa"
                                required
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="delegatePhone1">Phone Number</Label>
                                <Input
                                    id="delegatePhone1"
                                    name="delegatePhone1"
                                    placeholder="+48600700800"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="delegatePhone2">
                                    Alternative Phone (Optional)
                                </Label>
                                <Input
                                    id="delegatePhone2"
                                    name="delegatePhone2"
                                    placeholder="+48600700800"
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="librariesCount">Libraries Count</Label>
                                <Input
                                    id="librariesCount"
                                    name="librariesCount"
                                    type="number"
                                    min="0"
                                    defaultValue="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kindergartensCount">Kindergartens Count</Label>
                                <Input
                                    id="kindergartensCount"
                                    name="kindergartensCount"
                                    type="number"
                                    min="0"
                                    defaultValue="0"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deliveryDate">
                                Preferred Delivery Date (Optional)
                            </Label>
                            <Input id="deliveryDate" name="deliveryDate" type="date" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="protocolText">Protocol Text (Optional)</Label>
                            <Textarea
                                id="protocolText"
                                name="protocolText"
                                placeholder="Additional protocol details..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="protocolEmailRecipient">
                                Protocol Email Recipient (Optional)
                            </Label>
                            <Input
                                id="protocolEmailRecipient"
                                name="protocolEmailRecipient"
                                type="email"
                                placeholder="email@example.com"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={createMutation.isPending || !emailVerified}
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Order'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
