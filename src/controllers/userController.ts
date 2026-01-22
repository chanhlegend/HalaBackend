import { Request, Response } from 'express';

export const getUsers = (req: Request, res: Response): void => {
  res.json({ message: 'Get all users' });
};

export const getUserById = (req: Request, res: Response): void => {
  const { id } = req.params;
  res.json({ message: `Get user ${id}` });
};

export const createUser = (req: Request, res: Response): void => {
  res.json({ message: 'User created' });
};

export const updateUser = (req: Request, res: Response): void => {
  const { id } = req.params;
  res.json({ message: `User ${id} updated` });
};

export const deleteUser = (req: Request, res: Response): void => {
  const { id } = req.params;
  res.json({ message: `User ${id} deleted` });
};
