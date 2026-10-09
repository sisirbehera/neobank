import { isValidObjectId } from 'mongoose';
import {
  type AddBeneficiaryRequestSchema,
  type BeneficiaryDto,
  MAX_BENEFICIARIES_PER_USER,
} from '@neobank/shared/models';
import type { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { isDuplicateKey } from '../../lib/mongo-errors';
import { AccountModel } from '../accounts/account.model';
import { BeneficiaryModel, toBeneficiaryDto } from './beneficiary.model';

type AddBeneficiaryInput = z.output<typeof AddBeneficiaryRequestSchema>;

const notFound = () => HttpError.notFound('Beneficiary not found');

export class BeneficiariesService {
  async list(userId: string): Promise<BeneficiaryDto[]> {
    const beneficiaries = await BeneficiaryModel.find({ userId }).sort({
      name: 1,
    });
    return beneficiaries.map(toBeneficiaryDto);
  }

  async add(
    userId: string,
    input: AddBeneficiaryInput,
  ): Promise<BeneficiaryDto> {
    const count = await BeneficiaryModel.countDocuments({ userId });
    if (count >= MAX_BENEFICIARIES_PER_USER) {
      throw HttpError.conflict(
        `You can save at most ${MAX_BENEFICIARIES_PER_USER} beneficiaries`,
        'BENEFICIARY_LIMIT',
      );
    }

    const target = await AccountModel.findOne({
      accountNumber: input.accountNumber,
    });
    if (!target) {
      throw new HttpError(
        422,
        'ACCOUNT_NOT_FOUND',
        'No NeoBank account has this number',
        { accountNumber: ['No NeoBank account has this number'] },
      );
    }
    if (target.userId.equals(userId)) {
      const message =
        'This is one of your own accounts. You can transfer to it directly.';
      throw HttpError.badRequest(message, { accountNumber: [message] });
    }

    try {
      return toBeneficiaryDto(
        await BeneficiaryModel.create({ userId, ...input }),
      );
    } catch (err) {
      if (isDuplicateKey(err)) {
        const message = 'This account is already in your beneficiaries';
        throw HttpError.conflict(message, 'BENEFICIARY_EXISTS', {
          accountNumber: [message],
        });
      }
      throw err;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!isValidObjectId(id)) throw notFound();
    const { deletedCount } = await BeneficiaryModel.deleteOne({
      _id: id,
      userId,
    });
    if (deletedCount === 0) throw notFound();
  }
}
